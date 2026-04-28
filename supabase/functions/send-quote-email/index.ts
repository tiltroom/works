import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  eventType?: string;
  quoteId?: string;
  projectId?: string;
  recipientUserId?: string;
  locale?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const expectedSecret = Deno.env.get("EDGE_FUNCTION_SECRET");

  if (!expectedSecret) {
    console.error("EDGE_FUNCTION_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: EmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { to, subject, html, eventType, quoteId, projectId, recipientUserId } =
    payload;

  if (!to || !subject || !html) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: to, subject, html" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const smtpHost = Deno.env.get("SMTP_HOST") ?? "email-smtp.us-east-1.amazonaws.com";
  const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "2587");
  const smtpUser = Deno.env.get("SMTP_USERNAME") ?? "";
  const smtpPass = Deno.env.get("SMTP_PASSWORD") ?? "";
  const smtpFrom = Deno.env.get("SMTP_FROM") ?? "noreply@example.com";

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    requireTLS: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  try {
    const result = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send email", {
      eventType,
      quoteId,
      projectId,
      recipientUserId,
      error: message,
    });

    return new Response(
      JSON.stringify({ error: "Failed to send email" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
