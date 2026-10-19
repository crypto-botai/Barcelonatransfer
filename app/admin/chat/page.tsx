import AdminChat from "./AdminChat";

export const dynamic = "force-dynamic";

export default function AdminChatPage() {
  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-white">Live Chat</h1>
        <p className="text-dark-400 mt-1">
          Every ride conversation. Shared messages are seen by the customer and the driver; private messages are seen only by you and the person
          they are addressed to. Messages are stored on Elite BCN servers and are not end-to-end encrypted. Every action here is logged with your name.
        </p>
      </div>
      <AdminChat />
    </div>
  );
}
