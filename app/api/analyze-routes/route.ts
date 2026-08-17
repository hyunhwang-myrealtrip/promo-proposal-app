import {
  NextRequest,
  NextResponse,
} from "next/server";
import { google } from "googleapis";
import path from "path";

export const runtime = "nodejs";

type Vertex = {
  x?: number;
  y?: number;
};

type VisionWord = {
  text: string;
  xMin: number;
  xMax: number;
  yCenter: number;
  height: number;
};

type RouteItem = {
  region: string;
  departureCode: string;
  arrivalCode: string;
  arrivalCity: string;
  price: string;
  highlighted: boolean;
};

const AIRPORTS: Record<
  string,
  {
    city: string;
    region: string;
    aliases: string[];
  }
> = {
  ICN: {
    city: "인천",
    region: "한국",
    aliases: ["인천", "INCHEON"],
  },
  GMP: {
    city: "김포",
    region: "한국",
    aliases: ["김포", "GIMPO"],
  },
  PUS: {
    city: "부산",
    region: "한국",
    aliases: ["부산", "BUSAN"],
  },
  TAE: {
    city: "대구",
    region: "한국",
    aliases: ["대구", "DAEGU"],
  },
  CJJ: {
    city: "청주",
    region: "한국",
    aliases: ["청주", "CHEONGJU"],
  },
  CJU: {
    city: "제주",
    region: "한국",
    aliases: ["제주", "JEJU"],
  },

  NRT: {
    city: "도쿄",
    region: "일본",
    aliases: ["도쿄", "나리타", "TOKYO", "NARITA"],
  },
  HND: {
    city: "도쿄",
    region: "일본",
    aliases: ["하네다", "HANEDA"],
  },
  KIX: {
    city: "오사카",
    region: "일본",
    aliases: ["오사카", "OSAKA"],
  },
  UKB: {
    city: "고베",
    region: "일본",
    aliases: ["고베", "KOBE"],
  },
  FUK: {
    city: "후쿠오카",
    region: "일본",
    aliases: ["후쿠오카", "FUKUOKA"],
  },
  CTS: {
    city: "삿포로",
    region: "일본",
    aliases: ["삿포로", "SAPPORO"],
  },
  NGO: {
    city: "나고야",
    region: "일본",
    aliases: ["나고야", "NAGOYA"],
  },
  OKA: {
    city: "오키나와",
    region: "일본",
    aliases: ["오키나와", "OKINAWA"],
  },
  TAK: {
    city: "다카마쓰",
    region: "일본",
    aliases: ["다카마쓰", "다카마츠", "TAKAMATSU"],
  },
  SHI: {
    city: "시모지시마",
    region: "일본",
    aliases: ["시모지시마", "미야코지마", "SHIMOJISHIMA"],
  },
  KKJ: {
    city: "기타큐슈",
    region: "일본",
    aliases: ["기타큐슈", "기타큐우슈", "KITAKYUSHU"],
  },
  ISG: {
    city: "이시가키",
    region: "일본",
    aliases: ["이시가키", "ISHIGAKI"],
  },
  IBR: {
    city: "이바라키",
    region: "일본",
    aliases: ["이바라키", "IBARAKI"],
  },
  OBO: {
    city: "오비히로",
    region: "일본",
    aliases: ["오비히로", "OBIHIRO"],
  },
  HIJ: {
    city: "히로시마",
    region: "일본",
    aliases: ["히로시마", "HIROSHIMA"],
  },
  YGJ: {
    city: "돗토리/요나고",
    region: "일본",
    aliases: ["돗토리", "요나고", "TOTTORI", "YONAGO"],
  },
  TKS: {
    city: "도쿠시마",
    region: "일본",
    aliases: ["도쿠시마", "TOKUSHIMA"],
  },
  FSZ: {
    city: "시즈오카",
    region: "일본",
    aliases: ["시즈오카", "SHIZUOKA"],
  },
  MYJ: {
    city: "마쓰야마",
    region: "일본",
    aliases: ["마쓰야마", "마츠야마", "MATSUYAMA"],
  },
  OIT: {
    city: "오이타",
    region: "일본",
    aliases: ["오이타", "OITA"],
  },
  NGS: {
    city: "나가사키",
    region: "일본",
    aliases: ["나가사키", "NAGASAKI"],
  },
  OKJ: {
    city: "오카야마",
    region: "일본",
    aliases: ["오카야마", "OKAYAMA"],
  },
  KMQ: {
    city: "고마쓰",
    region: "일본",
    aliases: ["고마쓰", "고마츠", "KOMATSU"],
  },
  KOJ: {
    city: "가고시마",
    region: "일본",
    aliases: ["가고시마", "KAGOSHIMA"],
  },

  HAN: {
    city: "하노이",
    region: "동남아",
    aliases: ["하노이", "HANOI"],
  },
  SGN: {
    city: "호치민",
    region: "동남아",
    aliases: ["호치민", "HO CHI MINH", "HOCHIMINH"],
  },
  DAD: {
    city: "다낭",
    region: "동남아",
    aliases: ["다낭", "DANANG", "DA NANG"],
  },
  CXR: {
    city: "나트랑",
    region: "동남아",
    aliases: ["나트랑", "냐짱", "NHA TRANG"],
  },
  PQC: {
    city: "푸꾸옥",
    region: "동남아",
    aliases: ["푸꾸옥", "PHU QUOC"],
  },
  BKK: {
    city: "방콕",
    region: "동남아",
    aliases: ["방콕", "BANGKOK"],
  },
  CNX: {
    city: "치앙마이",
    region: "동남아",
    aliases: ["치앙마이", "CHIANG MAI"],
  },
  HKT: {
    city: "푸껫",
    region: "동남아",
    aliases: ["푸껫", "푸켓", "PHUKET"],
  },
  DPS: {
    city: "발리",
    region: "동남아",
    aliases: ["발리", "덴파사르", "BALI", "DENPASAR"],
  },
  CGK: {
    city: "자카르타",
    region: "동남아",
    aliases: ["자카르타", "JAKARTA"],
  },
  MNL: {
    city: "마닐라",
    region: "동남아",
    aliases: ["마닐라", "MANILA"],
  },
  CEB: {
    city: "세부",
    region: "동남아",
    aliases: ["세부", "CEBU"],
  },
  TAG: {
    city: "보홀",
    region: "동남아",
    aliases: ["보홀", "BOHOL", "PANGLAO"],
  },
  SIN: {
    city: "싱가포르",
    region: "동남아",
    aliases: ["싱가포르", "SINGAPORE"],
  },
  KUL: {
    city: "쿠알라룸푸르",
    region: "동남아",
    aliases: ["쿠알라룸푸르", "KUALA LUMPUR"],
  },
  BKI: {
    city: "코타키나발루",
    region: "동남아",
    aliases: ["코타키나발루", "KOTA KINABALU"],
  },
  CRK: {
    city: "클락",
    region: "동남아",
    aliases: ["클락", "CLARK"],
  },
  DEL: {
    city: "델리",
    region: "동남아",
    aliases: ["델리", "DELHI", "NEW DELHI"],
  },
  GUM: {
    city: "괌",
    region: "대양주",
    aliases: ["괌", "GUAM"],
  },
  SPN: {
    city: "사이판",
    region: "대양주",
    aliases: ["사이판", "SAIPAN"],
  },
  MEL: {
    city: "멜버른",
    region: "대양주",
    aliases: ["멜버른", "MELBOURNE"],
  },

  TPE: {
    city: "타이베이",
    region: "중화권",
    aliases: ["타이베이", "TAIPEI"],
  },
  RMQ: {
    city: "타이중",
    region: "중화권",
    aliases: ["타이중", "TAICHUNG"],
  },
  HKG: {
    city: "홍콩",
    region: "중화권",
    aliases: ["홍콩", "HONG KONG"],
  },
  PVG: {
    city: "상하이",
    region: "중화권",
    aliases: ["상하이", "SHANGHAI"],
  },
  PEK: {
    city: "베이징",
    region: "중화권",
    aliases: ["베이징", "BEIJING"],
  },
  TAO: {
    city: "칭다오",
    region: "중화권",
    aliases: ["칭다오", "청도", "QINGDAO"],
  },
  SHE: {
    city: "선양",
    region: "중화권",
    aliases: ["선양", "SHENYANG"],
  },
  WUH: {
    city: "우한",
    region: "중화권",
    aliases: ["우한", "WUHAN"],
  },
  TNA: {
    city: "지난",
    region: "중화권",
    aliases: ["지난", "JINAN"],
  },
  KHH: {
    city: "가오슝",
    region: "중화권",
    aliases: ["가오슝", "KAOHSIUNG"],
  },
  YNJ: {
    city: "옌지",
    region: "중화권",
    aliases: ["옌지", "YANJI"],
  },
  YNT: {
    city: "옌타이",
    region: "중화권",
    aliases: ["옌타이", "YANTAI"],
  },
  HUN: {
    city: "화롄",
    region: "중화권",
    aliases: ["화롄", "화련", "HUALIEN"],
  },
  WEH: {
    city: "웨이하이",
    region: "중화권",
    aliases: ["웨이하이", "WEIHAI"],
  },
  HRB: {
    city: "하얼빈",
    region: "중화권",
    aliases: ["하얼빈", "HARBIN"],
  },
  PKX: {
    city: "베이징 다싱",
    region: "중화권",
    aliases: ["베이징 다싱", "다싱", "DAXING"],
  },
  TSA: {
    city: "타이베이(송산)",
    region: "중화권",
    aliases: ["송산", "SONGSHAN"],
  },

  CDG: {
    city: "파리",
    region: "유럽",
    aliases: ["파리", "PARIS"],
  },
  FCO: {
    city: "로마",
    region: "유럽",
    aliases: ["로마", "ROME"],
  },
  LHR: {
    city: "런던",
    region: "유럽",
    aliases: ["런던", "LONDON"],
  },
  FRA: {
    city: "프랑크푸르트",
    region: "유럽",
    aliases: ["프랑크푸르트", "FRANKFURT"],
  },
  BCN: {
    city: "바르셀로나",
    region: "유럽",
    aliases: ["바르셀로나", "BARCELONA"],
  },
  AMS: {
    city: "암스테르담",
    region: "유럽",
    aliases: ["암스테르담", "AMSTERDAM"],
  },
  MXP: {
    city: "밀라노",
    region: "유럽",
    aliases: ["밀라노", "MILAN", "MILANO"],
  },
  ZRH: {
    city: "취리히",
    region: "유럽",
    aliases: ["취리히", "ZURICH"],
  },
  IST: {
    city: "이스탄불",
    region: "유럽",
    aliases: ["이스탄불", "ISTANBUL"],
  },
  MAD: {
    city: "마드리드",
    region: "유럽",
    aliases: ["마드리드", "MADRID"],
  },
  LIS: {
    city: "리스본",
    region: "유럽",
    aliases: ["리스본", "LISBON"],
  },
  PRG: {
    city: "프라하",
    region: "유럽",
    aliases: ["프라하", "PRAGUE"],
  },
  BUD: {
    city: "부다페스트",
    region: "유럽",
    aliases: ["부다페스트", "BUDAPEST"],
  },
  VIE: {
    city: "비엔나",
    region: "유럽",
    aliases: ["비엔나", "빈", "VIENNA"],
  },
  PMI: {
    city: "마요르카",
    region: "유럽",
    aliases: ["마요르카", "MALLORCA", "PALMA"],
  },
  AGP: {
    city: "말라가",
    region: "유럽",
    aliases: ["말라가", "MALAGA"],
  },
  NCE: {
    city: "니스",
    region: "유럽",
    aliases: ["니스", "NICE"],
  },
  VCE: {
    city: "베네치아",
    region: "유럽",
    aliases: ["베네치아", "VENICE", "VENEZIA"],
  },
  LGW: {
    city: "런던(개트윅)",
    region: "유럽",
    aliases: ["개트윅", "GATWICK"],
  },
  GVA: {
    city: "제네바",
    region: "유럽",
    aliases: ["제네바", "GENEVA"],
  },

  AUH: {
    city: "아부다비",
    region: "중동",
    aliases: ["아부다비", "ABU DHABI"],
  },
  CAI: {
    city: "카이로",
    region: "아프리카",
    aliases: ["카이로", "CAIRO"],
  },
  ALA: {
    city: "알마티",
    region: "중앙아시아",
    aliases: ["알마티", "ALMATY"],
  },

  LAX: {
    city: "로스앤젤레스",
    region: "미주",
    aliases: ["로스앤젤레스", "LOS ANGELES"],
  },
  JFK: {
    city: "뉴욕",
    region: "미주",
    aliases: ["뉴욕", "NEW YORK"],
  },
  SFO: {
    city: "샌프란시스코",
    region: "미주",
    aliases: ["샌프란시스코", "SAN FRANCISCO"],
  },
  YVR: {
    city: "밴쿠버",
    region: "미주",
    aliases: ["밴쿠버", "VANCOUVER"],
  },
  ATL: {
    city: "애틀랜타",
    region: "미주",
    aliases: ["애틀랜타", "ATLANTA"],
  },
  BOS: {
    city: "보스턴",
    region: "미주",
    aliases: ["보스턴", "BOSTON"],
  },
  DFW: {
    city: "댈러스",
    region: "미주",
    aliases: ["댈러스", "DALLAS"],
  },
  HNL: {
    city: "호놀룰루",
    region: "미주",
    aliases: ["호놀룰루", "HONOLULU"],
  },
  IAD: {
    city: "워싱턴 D.C.",
    region: "미주",
    aliases: ["워싱턴", "WASHINGTON"],
  },
  LAS: {
    city: "라스베이거스",
    region: "미주",
    aliases: ["라스베이거스", "LAS VEGAS"],
  },
  ORD: {
    city: "시카고",
    region: "미주",
    aliases: ["시카고", "CHICAGO"],
  },
  YYZ: {
    city: "토론토",
    region: "미주",
    aliases: ["토론토", "TORONTO"],
  },
  SEA: {
    city: "시애틀",
    region: "미주",
    aliases: ["시애틀", "SEATTLE"],
  },
  YYC: {
    city: "캘거리",
    region: "미주",
    aliases: ["캘거리", "CALGARY"],
  },
  YUL: {
    city: "몬트리올",
    region: "미주",
    aliases: ["몬트리올", "MONTREAL"],
  },

  SYD: {
    city: "시드니",
    region: "대양주",
    aliases: ["시드니", "SYDNEY"],
  },
  BNE: {
    city: "브리즈번",
    region: "대양주",
    aliases: ["브리즈번", "BRISBANE"],
  },
  AKL: {
    city: "오클랜드",
    region: "대양주",
    aliases: ["오클랜드", "AUCKLAND"],
  },

  CAN: {
    city: "광저우",
    region: "중화권",
    aliases: ["광저우", "GUANGZHOU"],
  },
  CGO: {
    city: "정저우",
    region: "중화권",
    aliases: ["정저우", "ZHENGZHOU"],
  },
  CSX: {
    city: "창사",
    region: "중화권",
    aliases: ["창사", "CHANGSHA"],
  },
  DYG: {
    city: "장자제",
    region: "중화권",
    aliases: ["장자제", "ZHANGJIAJIE"],
  },
  MFM: {
    city: "마카오",
    region: "중화권",
    aliases: ["마카오", "MACAU", "MACAO"],
  },
  SZX: {
    city: "선전",
    region: "중화권",
    aliases: ["선전", "SHENZHEN"],
  },
};

const DEPARTURE_CODES = new Set([
  "ICN",
  "GMP",
  "PUS",
  "TAE",
  "CJJ",
  "CJU",
]);

export async function POST(
  request: NextRequest,
) {
  try {
    const formData =
      await request.formData();
    const image =
      formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "분석할 이미지가 없습니다.",
        },
        {
          status: 400,
        },
      );
    }

    const serviceAccountFile =
      process.env
        .GOOGLE_SERVICE_ACCOUNT_FILE;

    if (!serviceAccountFile) {
      return NextResponse.json(
        {
          success: false,
          message:
            "GOOGLE_SERVICE_ACCOUNT_FILE 설정이 없습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const auth =
      new google.auth.GoogleAuth({
        keyFile: path.join(
          process.cwd(),
          serviceAccountFile,
        ),
        scopes: [
          "https://www.googleapis.com/auth/cloud-platform",
        ],
      });

    const authClient =
      await auth.getClient();

    const base64Image =
      Buffer.from(
        await image.arrayBuffer(),
      ).toString("base64");

    const visionResponse =
      await authClient.request<{
        responses?: Array<{
          error?: {
            message?: string;
          };
          fullTextAnnotation?: {
            text?: string;
            pages?: Array<{
              blocks?: Array<{
                paragraphs?: Array<{
                  words?: Array<{
                    symbols?: Array<{
                      text?: string;
                    }>;
                    boundingBox?: {
                      vertices?: Vertex[];
                    };
                  }>;
                }>;
              }>;
            }>;
          };
        }>;
      }>({
        url:
          "https://vision.googleapis.com/v1/images:annotate",
        method: "POST",
        data: {
          requests: [
            {
              image: {
                content:
                  base64Image,
              },
              features: [
                {
                  type:
                    "DOCUMENT_TEXT_DETECTION",
                },
              ],
              imageContext: {
                languageHints: [
                  "ko",
                  "en",
                ],
              },
            },
          ],
        },
      });

    const annotation =
      visionResponse.data
        .responses?.[0];

    if (
      annotation?.error
        ?.message
    ) {
      throw new Error(
        annotation.error.message,
      );
    }

    const words =
      extractWords(
        annotation
          ?.fullTextAnnotation
          ?.pages ?? [],
      );

    let routes =
      parseRoutesFromCoordinates(
        words,
      );

    if (routes.length === 0) {
      routes =
        parseRoutesFromPlainText(
          annotation
            ?.fullTextAnnotation
            ?.text ?? "",
        );
    }

    return NextResponse.json({
      success: true,
      routes,
      detectedText:
        annotation
          ?.fullTextAnnotation
          ?.text ?? "",
    });
  } catch (error) {
    console.error(
      "Google Vision 노선 분석 오류:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "노선 이미지 분석에 실패했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}

function extractWords(
  pages: Array<{
    blocks?: Array<{
      paragraphs?: Array<{
        words?: Array<{
          symbols?: Array<{
            text?: string;
          }>;
          boundingBox?: {
            vertices?: Vertex[];
          };
        }>;
      }>;
    }>;
  }>,
): VisionWord[] {
  const words: VisionWord[] =
    [];

  for (const page of pages) {
    for (
      const block of
        page.blocks ?? []
    ) {
      for (
        const paragraph of
          block.paragraphs ??
          []
      ) {
        for (
          const word of
            paragraph.words ??
            []
        ) {
          const text =
            (word.symbols ?? [])
              .map(
                (symbol) =>
                  symbol.text ??
                  "",
              )
              .join("")
              .trim();

          if (!text) {
            continue;
          }

          const vertices =
            word.boundingBox
              ?.vertices ?? [];

          const xs =
            vertices.map(
              (vertex) =>
                vertex.x ?? 0,
            );
          const ys =
            vertices.map(
              (vertex) =>
                vertex.y ?? 0,
            );

          if (
            xs.length === 0 ||
            ys.length === 0
          ) {
            continue;
          }

          const xMin =
            Math.min(...xs);
          const xMax =
            Math.max(...xs);
          const yMin =
            Math.min(...ys);
          const yMax =
            Math.max(...ys);

          words.push({
            text,
            xMin,
            xMax,
            yCenter:
              (yMin + yMax) /
              2,
            height:
              Math.max(
                yMax - yMin,
                1,
              ),
          });
        }
      }
    }
  }

  return words;
}

function parseRoutesFromCoordinates(
  words: VisionWord[],
): RouteItem[] {
  if (words.length === 0) {
    return [];
  }

  const sortedHeights =
    words
      .map(
        (word) =>
          word.height,
      )
      .sort(
        (a, b) => a - b,
      );

  const medianHeight =
    sortedHeights[
      Math.floor(
        sortedHeights.length /
          2,
      )
    ] ?? 14;

  const tolerance =
    Math.max(
      medianHeight * 0.75,
      8,
    );

  const rows: VisionWord[][] =
    [];

  for (
    const word of [...words].sort(
      (a, b) =>
        a.yCenter -
          b.yCenter ||
        a.xMin - b.xMin,
    )
  ) {
    let targetRow:
      | VisionWord[]
      | undefined;

    let bestDistance =
      Number.POSITIVE_INFINITY;

    for (const row of rows) {
      const rowCenter =
        row.reduce(
          (sum, item) =>
            sum +
            item.yCenter,
          0,
        ) / row.length;

      const distance =
        Math.abs(
          rowCenter -
            word.yCenter,
        );

      if (
        distance <=
          tolerance &&
        distance <
          bestDistance
      ) {
        targetRow = row;
        bestDistance =
          distance;
      }
    }

    if (targetRow) {
      targetRow.push(word);
    } else {
      rows.push([word]);
    }
  }

  const routes: RouteItem[] =
    [];

  for (const row of rows) {
    const rowText = row
      .sort(
        (a, b) =>
          a.xMin - b.xMin,
      )
      .map(
        (word) =>
          word.text,
      )
      .join(" ");

    const route =
      parseRouteRow(
        rowText,
      );

    if (route) {
      routes.push(route);
    }
  }

  return deduplicateRoutes(
    routes,
  );
}

function parseRoutesFromPlainText(
  text: string,
): RouteItem[] {
  const routes =
    text
      .replace(/\r/g, "")
      .split("\n")
      .map(
        (line) =>
          parseRouteRow(line),
      )
      .filter(
        (
          route,
        ): route is RouteItem =>
          Boolean(route),
      );

  return deduplicateRoutes(
    routes,
  );
}

function parseRouteRow(
  rawText: string,
): RouteItem | null {
  const text =
    normalizeText(rawText);

  if (
    !text ||
    /권역|출발지|도착지|출발 공항|도착 공항/.test(
      text,
    )
  ) {
    return null;
  }

  const detectedCodes =
    findCodesInText(text);

  let departureCode =
    detectedCodes.find(
      (code) =>
        DEPARTURE_CODES.has(
          code,
        ),
    ) ?? "";

  let arrivalCode =
    detectedCodes.find(
      (code) =>
        !DEPARTURE_CODES.has(
          code,
        ),
    ) ?? "";

  if (!departureCode) {
    departureCode =
      findCodeByAlias(
        text,
        true,
      );
  }

  if (!arrivalCode) {
    arrivalCode =
      findCodeByAlias(
        text,
        false,
      );
  }

  if (
    !departureCode ||
    !arrivalCode ||
    departureCode ===
      arrivalCode
  ) {
    return null;
  }

  const destination =
    AIRPORTS[arrivalCode];

  if (!destination) {
    return null;
  }

  return {
    region:
      destination.region,
    departureCode,
    arrivalCode,
    arrivalCity:
      destination.city,
    price:
      findPrice(rawText),
    highlighted: false,
  };
}

function findCodesInText(
  text: string,
): string[] {
  const candidates =
    Array.from(
      text.matchAll(
        /\b[A-Z0-9]{3}\b/g,
      ),
    ).map(
      (match) =>
        repairCode(
          match[0],
        ),
    );

  return Array.from(
    new Set(
      candidates.filter(
        (code) =>
          Boolean(
            AIRPORTS[code],
          ),
      ),
    ),
  );
}

function repairCode(
  value: string,
) {
  const upper =
    value.toUpperCase();

  if (AIRPORTS[upper]) {
    return upper;
  }

  const replacements =
    [
      upper.replace(
        /0/g,
        "O",
      ),
      upper.replace(
        /1/g,
        "I",
      ),
      upper.replace(
        /5/g,
        "S",
      ),
      upper.replace(
        /8/g,
        "B",
      ),
    ];

  return (
    replacements.find(
      (candidate) =>
        AIRPORTS[candidate],
    ) ?? upper
  );
}

function findCodeByAlias(
  text: string,
  departureOnly: boolean,
) {
  for (const [
    code,
    airport,
  ] of Object.entries(
    AIRPORTS,
  )) {
    if (
      departureOnly !==
      DEPARTURE_CODES.has(
        code,
      )
    ) {
      continue;
    }

    const matched =
      airport.aliases.some(
        (alias) =>
          text.includes(
            normalizeText(
              alias,
            ),
          ),
      );

    if (matched) {
      return code;
    }
  }

  return "";
}

function findPrice(
  text: string,
) {
  return (
    text.match(
      /(\d{1,3}(?:,\d{3})+|\d{5,7})\s*원?/,
    )?.[0] ?? ""
  );
}

function normalizeText(
  value: string,
) {
  return value
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[|｜]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function deduplicateRoutes(
  routes: RouteItem[],
) {
  const unique = new Map<
    string,
    RouteItem
  >();

  for (const route of routes) {
    const key =
      `${route.departureCode}-${route.arrivalCode}`;

    if (!unique.has(key)) {
      unique.set(
        key,
        route,
      );
    }
  }

  return Array.from(
    unique.values(),
  );
}
