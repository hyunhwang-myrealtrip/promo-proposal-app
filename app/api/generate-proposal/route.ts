import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 빌드/모듈 로드 시점에 OPENAI_API_KEY가 없으면 즉시 예외가 나므로,
// 요청이 들어왔을 때만 생성합니다.
function getOpenAiClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("문구 생성 결과에서 JSON을 찾지 못했습니다.");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

export async function POST(request: Request) {
  try {
    const input = await request.json();

    const highlightedRoutes = Array.isArray(input.routes)
      ? input.routes.filter(
          (route: { highlighted?: boolean }) =>
            route.highlighted,
        )
      : [];

    const prompt = `
당신은 항공 여행 프로모션 페이지의 상품안과 카피를 작성하는 전문 기획자입니다.

아래 입력 정보를 바탕으로 실제 프모페 제작에 사용할 상품안을 생성하세요.

입력 정보:
${JSON.stringify(input, null, 2)}

강조 노선:
${JSON.stringify(highlightedRoutes, null, 2)}

작성 원칙:

1. 사실과 숫자는 입력값을 바꾸지 마세요.
2. 입력에 없는 할인율, 가격, 혜택을 만들어내지 마세요.
3. 추상적인 표현만 사용하지 말고 여행지의 실제 특징을 반영하세요.
4. 각 여행지 문구가 서로 겹치지 않게 작성하세요.
5. 강조 노선을 추천 여행지에서 우선적으로 선택하세요.
6. 강조 노선이 부족하면 전체 노선에서 보완하세요.
7. 혜택 원문은 유지하고, 각 혜택에 어울리는 서브 문구만 추가하세요.
8. 메인 카피는 짧고 직관적으로 작성하세요.
9. 사용자에게 보여줄 설명이나 마크다운 없이 JSON만 출력하세요.

결과 구조:

{
  "mainVisual": {
    "topCopy": "",
    "mainTitle": "",
    "subCopy": "",
    "cta": ""
  },
  "liveSection": {
    "title": "",
    "dateCopy": "",
    "description": "",
    "cta": ""
  },
  "liveBenefits": [
    {
      "mainCopy": "",
      "subCopy": ""
    }
  ],
  "purchaseBenefits": [
    {
      "mainCopy": "",
      "subCopy": ""
    }
  ],
  "airlineHighlights": [
    {
      "mainCopy": "",
      "subCopy": ""
    }
  ],
  "recommendedDestinations": [
    {
      "city": "",
      "airportCode": "",
      "departureCode": "",
      "mainCopy": "",
      "subCopy": "",
      "imageKeywords": ""
    }
  ],
  "searchSection": {
    "title": "",
    "cta": "",
    "description": ""
  }
}
`;

    const openai = getOpenAiClient();

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    return NextResponse.json(extractJson(response.output_text));
  } catch (error) {
    console.error("Proposal generation error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "상품안 생성 중 오류가 발생했습니다.";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}