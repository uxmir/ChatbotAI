import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { dbConnect } from "../../../lib/db";
import ChatSession from "@/models/ChatSession";
import { headers } from "next/headers";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const foundTitle = await ChatSession.find({ user: session.user.id })
      .select("title")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      message: "Data fetched successfully",
      data: foundTitle,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}