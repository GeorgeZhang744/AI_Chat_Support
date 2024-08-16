"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the Headstarter support assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  const sendMessage = async (event) => {
    event.preventDefault();

    if (!input.trim() || isLoading) return;

    setIsLoading(true);

    setInput("");
    setMessages((messages) => [...messages, { role: "user", content: input }, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify([...messages, { role: "user", content: input }]),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1];
          let otherMessages = messages.slice(0, messages.length - 1);
          return [...otherMessages, { ...lastMessage, content: lastMessage.content + text }];
        });

        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((messages) => [
        ...messages,
        { role: "assistant", content: "I'm sorry, but I encountered an error. Please try again later." },
      ]);
    }
  };


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Ensure the most recent message are always visible
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between sm:p-12 p-4 text-black">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-4 flex flex-col">
        {/* Chat window with fixed height and scrollable overflow */}
        <div className="mb-4 space-y-2 p-2 border-b overflow-y-auto" style={{ height: "70vh", width: "100%" }}>
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <span className={`inline-block p-2 rounded ${msg.role === "user" ? "bg-blue-400 text-white" : "bg-gray-200"}`}>
                {msg.content}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {/* Input field for sending messages */}
        <form onSubmit={(e) => sendMessage(e)} className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-2 py-1 border rounded-l"
            placeholder="Type your message..."
          />
          <button type="submit" disabled={isLoading} className="px-4 py-1 bg-blue-500 text-white rounded-r">
            {isLoading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}
