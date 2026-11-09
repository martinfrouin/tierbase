import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Suggest a missing title, report a bug or send any other message.",
};

export default function ContactPage() {
  return (
    <article className="legal">
      <h1>Contact</h1>
      <p className="muted">
        A title is missing, a match is wrong, something is broken? Tell me here. Your email is only used to answer you
        (see <Link href="/privacy">privacy</Link>).
      </p>
      <ContactForm />
    </article>
  );
}
