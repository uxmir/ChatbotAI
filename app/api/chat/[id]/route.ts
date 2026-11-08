import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { dbConnect } from "../../../lib/db";
import ChatSession from "@/models/ChatSession";
import { headers } from "next/headers";
// GET Single Chat History
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const foundData = await ChatSession.findOne({
      _id: id,
      user: session.user.id,
    });

    if (!foundData) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Data fetched successfully",
      data: foundData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// UPDATE Session Title
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await dbConnect();

    const updateTitle = await ChatSession.findByIdAndUpdate(id, body, {
      returnDocument: "after",
      runValidators: true,
    });

    return NextResponse.json({
      success: true,
      message: "Data updated successfully",
      data: updateTitle,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE Chat Session
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const deleteData = await ChatSession.findByIdAndDelete(id);
    return NextResponse.json({
      success: true,
      message: "Data deleted successfully",
      data: deleteData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}