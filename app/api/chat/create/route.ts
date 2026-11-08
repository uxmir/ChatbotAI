import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { dbConnect } from "../../../lib/db";
import ChatSession from "@/models/ChatSession";
import { checkOpenAI } from "../../../lib/ai"; 
import uploadToImagekit from "../../../lib/uploadImagekit"; 
import { headers } from "next/headers";
export async function POST(req: Request) {
  try {
    // 1. Authenticate with Better Auth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Safely parse request based on Content-Type (Supports both JSON & FormData)
    let text = "";
    let sessionId = "";
    let imageUrl = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      text = (formData.get("text") as string) || "";
      sessionId = (formData.get("sessionId") as string) || "";
      const file = formData.get("file") as File | null;

      if (file && typeof file === "object" && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const responseImage = await uploadToImagekit(buffer, file.name);
        imageUrl = responseImage.url;
      }
    } else {
      const body = await req.json();
      text = body.text || "";
      sessionId = body.sessionId || "";
    }

    if (!text && !imageUrl) {
      return NextResponse.json({ error: "Please ask something" }, { status: 400 });
    }

    await dbConnect();

    // 3. Construct Chat History (OpenAI Format)
    let messages: any[] = [];
    const validSessionId = sessionId && sessionId !== "undefined" && sessionId !== "null" ? sessionId : null;

    if (validSessionId) {
      try {
        const existingSession = await ChatSession.findById(validSessionId);
        if (existingSession && existingSession.chats) {
          existingSession.chats.forEach((chat: any) => {
            const a = chat.userInput;
            const b = chat.imageUrl;
            const c = chat.aiData;

            if (a || b) {
              let userContent: any[] = [];
              if (a) userContent.push({ type: "text", text: a });
              if (b) userContent.push({ type: "image_url", image_url: { url: b } });
              messages.push({ role: "user", content: userContent });
            }
            if (c) {
              messages.push({ role: "assistant", content: c });
            }
          });
        }
      } catch (dbErr) {
        console.error("Error fetching chat history:", dbErr);
      }
    }

    let currentContent: any[] = [];
    if (text) currentContent.push({ type: "text", text: text });
    if (imageUrl) currentContent.push({ type: "image_url", image_url: { url: imageUrl } });

    if (currentContent.length > 0) {
      messages.push({ role: "user", content: currentContent });
    } else {
      messages.push({ role: "user", content: "Hello" });
    }

    // 4. OpenAI Stream Request
    const ai = await checkOpenAI();
    const responseStream = await ai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      stream: true,
    });

    // 5. Next.js Web Stream (SSE Setup)
    const encoder = new TextEncoder();
    let aiReply = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              aiReply += content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
              );
            }
          }

          // Save Session into MongoDB after completion
          const sessionTitle = text ? text.substring(0, 25) : "Chat History";
          let savedSession;

          if (validSessionId) {
            try {
              savedSession = await ChatSession.findByIdAndUpdate(
                validSessionId,
                {
                  $push: {
                    chats: { userInput: text, aiData: aiReply, imageUrl: imageUrl },
                  },
                },
                { returnDocument: "after" }
              );
            } catch (updateErr) {
              console.error("Error updating session:", updateErr);
            }
          } 
          
          if (!savedSession) {
            savedSession = await ChatSession.create({
              user: userId,
              newSession: true,
              title: sessionTitle,
              chats: [{ userInput: text, aiData: aiReply, imageUrl: imageUrl }],
            });
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, session: savedSession })}\n\n`)
          );
          controller.close();
        } catch (err: any) {
          console.error("Stream execution error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("API Route /api/chat/create Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}