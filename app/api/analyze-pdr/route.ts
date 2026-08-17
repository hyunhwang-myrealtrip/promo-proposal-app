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

type ImageContent = {
  type: "input_image";
  image_url: string;
  detail: "high";
};

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("분석 결과에서 JSON을 찾을 수 없습니다.");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            ".env.local에 OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const promotionType =
      formData.get("promotionType")?.toString() ?? "live";

    const files = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "분석할 이미지를 추가해 주세요." },
        { status: 400 },
      );
    }

    const imageContents: ImageContent[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");

      imageContents.push({
        type: "input_image",
        image_url: `data:${file.type};base64,${base64}`,
        detail: "high",
      });
    }

    const prompt = `
당신은 항공 프로모션 PDR 문서를 분석하는 전문가입니다.

업로드된 모든 이미지는 하나의 PDR 문서를 나누어 캡처한 것일 수 있습니다.
모든 이미지를 함께 확인하고, 서로 이어지는 표와 문장을 병합하세요.

프로모션 유형:
${promotionType === "live" ? "라이브 프로모션" : "일반 기획전"}

반드시 지켜야 할 규칙:

1. 이미지에 실제로 적힌 정보만 추출하세요.
2. 없는 정보는 추측하지 말고 빈 문자열 또는 빈 배열로 반환하세요.
3. 운영 노선은 이미지에 등장하는 노선을 한 개도 빠뜨리지 마세요.
4. 인천뿐 아니라 부산, 김포, 청주, 대구, 제주 등 모든 출발지를 확인하세요.
5. 표가 여러 이미지에 나뉘어 있으면 이어서 하나의 노선 목록으로 합치세요.
6. 중복 노선만 제거하고, 출발지가 다르면 별개의 노선으로 유지하세요.
7. 공항 코드가 있다면 반드시 저장하세요.
8. 날짜는 가능한 한 YYYY-MM-DD 형식으로 변환하세요.
9. 시간은 YYYY-MM-DDTHH:mm 형식으로 변환하세요.
10. 라이브 전용 혜택과 항공권 구매 혜택을 구분할 수 없으면
   liveBenefits에는 명확한 라이브 혜택만 넣고,
   나머지는 purchaseBenefits에 넣으세요.
11. GMV 목표, 탑승객 목표, 지난 프로모션 성과는 상품안에 필요하지 않으므로 제외하세요.
12. JSON 이외의 문장은 절대 출력하지 마세요.

아래 JSON 구조로만 반환하세요.

{
  "airline": "",
  "promotionName": "",
  "subtitle": "",
  "salePeriod": {
    "start": "",
    "end": ""
  },
  "travelPeriod": {
    "start": "",
    "end": ""
  },
  "livePeriod": {
    "start": "",
    "end": ""
  },
  "preNotificationPeriod": {
    "start": "",
    "end": ""
  },
  "liveBenefits": [],
  "purchaseBenefits": [],
  "airlineHighlights": [],
  "routes": [
    {
      "region": "",
      "departureCity": "",
      "departureCode": "",
      "arrivalCity": "",
      "arrivalCode": "",
      "price": "",
      "confidence": "high"
    }
  ]
}
`;

    const openai = getOpenAiClient();

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            ...imageContents,
          ],
        },
      ],
    });

    const result = extractJson(response.output_text);

    const uniqueRoutes = Array.isArray(result.routes)
      ? result.routes.filter(
          (
            route: {
              departureCode?: string;
              departureCity?: string;
              arrivalCode?: string;
              arrivalCity?: string;
            },
            index: number,
            routes: Array<{
              departureCode?: string;
              departureCity?: string;
              arrivalCode?: string;
              arrivalCity?: string;
            }>,
          ) => {
            const currentKey = [
              route.departureCode || route.departureCity,
              route.arrivalCode || route.arrivalCity,
            ]
              .join("-")
              .toUpperCase();

            return (
              routes.findIndex((candidate) => {
                const candidateKey = [
                  candidate.departureCode ||
                    candidate.departureCity,
                  candidate.arrivalCode ||
                    candidate.arrivalCity,
                ]
                  .join("-")
                  .toUpperCase();

                return candidateKey === currentKey;
              }) === index
            );
          },
        )
      : [];

    return NextResponse.json({
      ...result,
      routes: uniqueRoutes,
    });
  } catch (error) {
    console.error("PDR analysis error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "PDR 분석 중 알 수 없는 오류가 발생했습니다.";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}