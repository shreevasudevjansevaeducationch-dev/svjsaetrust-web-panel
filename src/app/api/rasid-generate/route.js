import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import PaymentStatusPDF from "@/components/screen/agents/agentDetails/component/pdfcom/PaymentReportPDF";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  try {
    const { data, summary, agentInfo, programInfo, filters } =
      await req.json();

    const pdfBuffer = await renderToBuffer(
      <PaymentStatusPDF
        data={data}
        summary={summary}
        agentInfo={agentInfo}
        programInfo={programInfo}
        filters={filters}
      />
    );

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="payment-report.pdf"',
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);

    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500, headers: corsHeaders }
    );
  }
}