import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import OpenAI from "openai";

// System prompt for the AI, providing guidelines on how to respond to users
const systemPrompt = `
  You are an AI-powered customer support assistant created to help users with their questions, issues, and inquiries. Your role is to provide friendly, clear, and accurate assistance to users. Follow these guidelines:

  1. **Greeting**: Always start by greeting the user and offering your help. For example, "Hello! How can I assist you today?"
  2. **Understanding the Issue**: If the user describes a problem, ask clarifying questions if necessary to fully understand their issue.
  3. **Providing Assistance**: Offer clear, step-by-step guidance or answers to the user's questions. Make sure your instructions are easy to follow.
  4. **Empathy**: If the user seems frustrated or confused, acknowledge their feelings with empathy. For example, "I'm sorry you're experiencing this issue. Let's see how I can help."
  5. **Limitations**: If you encounter a problem you can't solve, politely explain that you're limited in certain areas and suggest they seek help from a human expert. For example, "I apologize, but I might not be able to fully resolve this issue. It might be best to consult with a specialist."
  6. **Politeness and Professionalism**: Maintain a polite and professional tone throughout the interaction, making sure the user feels heard and valued.
  7. **Closing**: Always end the conversation politely, asking if there's anything else the user needs help with. For example, "Is there anything else I can assist you with?"

  Here are a few examples of interactions:
  - **User**: "I can't figure out how to reset my password."
  - **AI**: "No problem! Let me guide you through resetting your password. First, please click on the 'Forgot Password' link on the login page..."

  - **User**: "The app keeps crashing when I try to open it."
  - **AI**: "I'm sorry you're having trouble with the app crashing. Can you let me know what device you're using? This will help me give you more specific advice."

  Remember to keep your responses concise and focused on helping the user as effectively as possible. Begin by asking, 'How can I help you today?' and follow these guidelines to provide the best possible support.
`;

const ratelimit = new Ratelimit({ redis: kv, limiter: Ratelimit.slidingWindow(5, "10s") });

export const runtime = "edge";

// POST function to handle incoming requests
export async function POST(req) {
  const ip = req.ip ?? "127.0.0.1";

  const { limit, reset, remaining} = await ratelimit.limit(ip);

  if (remaining === 0) {
    return new NextResponse(JSON.stringify({error: "Rate limit exceeded"}), {
      status: '429',
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString()
      }
    })
  }

  const openai = new OpenAI(); // Create a new instance of the OpenAI client
  const data = await req.json(); // Parse the JSON body of the incoming request

  // Create a chat completion request to the OpenAI API
  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: systemPrompt }, ...data], // Include the system prompt and user messages
    model: "gpt-4o", // Specify the model to use
    stream: true, // Enable streaming responses
  });

  // Create a ReadableStream to handle the streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder(); // Create a TextEncoder to convert strings to Uint8Array
      try {
        // Iterate over the streamed chunks of the response
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content; // Extract the content from the chunk
          if (content) {
            const text = encoder.encode(content); // Encode the content to Uint8Array
            controller.enqueue(text); // Enqueue the encoded text to the stream
          }
        }
      } catch (err) {
        controller.error(err); // Handle any errors that occur during streaming
      } finally {
        controller.close(); // Close the stream when done
      }
    },
  });

  return new NextResponse(stream); // Return the stream as the response
}
