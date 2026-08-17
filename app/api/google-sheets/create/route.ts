import {
  NextRequest,
  NextResponse,
} from "next/server";
import { google } from "googleapis";
import path from "path";

type BenefitItem = {
  category?: string;
  name?: string;
};

type GiftItem = {
  category?: string;
  name?: string;
  quantity?: string;
};

type RouteItem = {
  region?: string;
  departureCode?: string;
  arrivalCode?: string;
  arrivalCity?: string;
  price?: string;
  highlighted?: boolean;
};

type CreatePdrRequest = {
  sheetName?: string;
  promotionType?: string;
  promotionName?: string;
  subtitle?: string;
  airline?: string;
  saleStart?: string;
  saleEnd?: string;
  preNotificationStart?: string;
  preNotificationEnd?: string;
  liveStart?: string;
  travelStart?: string;
  travelEnd?: string;
  liveBenefits?: BenefitItem[];
  liveGifts?: GiftItem[];
  purchaseBenefits?: BenefitItem[];
  airlineHighlights?: string[];
  routes?: RouteItem[];
};

type SectionDefinition = {
  title: string;
  values: string[][];
  columnCount: number;
};

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      (await request.json()) as CreatePdrRequest;

    const isLive = isLivePromotion(
      body.promotionType,
    );

    const spreadsheetId =
      process.env.GOOGLE_SPREADSHEET_ID;
    const templateSheetName =
      process.env.GOOGLE_TEMPLATE_SHEET_NAME;
    const serviceAccountJson =
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const serviceAccountFile =
      process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    const htkSpreadsheetId =
      process.env.GOOGLE_HTK_SPREADSHEET_ID;
    const htkTemplateSheetName =
      process.env.GOOGLE_HTK_TEMPLATE_SHEET_NAME;

    const requiredSettings: Array<
      [string, string | undefined]
    > = [
      ["GOOGLE_SPREADSHEET_ID", spreadsheetId],
      ["GOOGLE_TEMPLATE_SHEET_NAME", templateSheetName],
      // 서비스 계정 인증은 로컬 키파일(GOOGLE_SERVICE_ACCOUNT_FILE) 또는
      // 배포 환경변수(GOOGLE_SERVICE_ACCOUNT_JSON) 중 하나만 있으면 됩니다.
      [
        "GOOGLE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_SERVICE_ACCOUNT_FILE",
        serviceAccountJson || serviceAccountFile,
      ],
    ];

    // HTK 상품안은 라이브 프로모션일 때만 만들기 때문에
    // 해당 설정도 라이브일 때만 필수로 검사합니다.
    if (isLive) {
      requiredSettings.push(
        ["GOOGLE_HTK_SPREADSHEET_ID", htkSpreadsheetId],
        ["GOOGLE_HTK_TEMPLATE_SHEET_NAME", htkTemplateSheetName],
      );
    }

    const missingSettings = requiredSettings
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missingSettings.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `환경변수 설정 누락: ${missingSettings.join(", ")}`,
        },
        { status: 500 },
      );
    }

    const auth = createGoogleAuth(
      serviceAccountJson,
      serviceAccountFile,
    );

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    // 두 스프레드시트 작업을 서로 독립적으로 동시에 실행합니다.
    // HTK 상품안은 라이브 프로모션일 때만 생성합니다.
    const [promoSettled, htkSettled] =
      await Promise.allSettled([
        createPromoPdr({
          sheets,
          spreadsheetId: spreadsheetId!,
          templateSheetName: templateSheetName!,
          body,
        }),
        isLive
          ? createHtkPdr({
              sheets,
              spreadsheetId: htkSpreadsheetId!,
              templateSheetName: htkTemplateSheetName!,
              body,
            })
          : Promise.resolve(null),
      ]);

    const promo =
      promoSettled.status === "fulfilled"
        ? promoSettled.value
        : null;
    const htk =
      htkSettled.status === "fulfilled"
        ? htkSettled.value
        : null;

    const promoError =
      promoSettled.status === "rejected"
        ? getErrorMessage(promoSettled.reason)
        : "";
    const htkError =
      isLive && htkSettled.status === "rejected"
        ? getErrorMessage(htkSettled.reason)
        : "";

    if (!promo && (!isLive || !htk)) {
      return NextResponse.json(
        {
          success: false,
          partialSuccess: false,
          message: isLive
            ? `PDR 생성 실패: ${promoError}\n` +
              `HTK 상품안 생성 실패: ${htkError}`
            : `PDR 생성 실패: ${promoError}`,
          promoError,
          htkError,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      partialSuccess: isLive ? !promo || !htk : false,
      promo,
      htk,
      promoError,
      htkError,
      message: !isLive
        ? "PDR을 성공적으로 생성했습니다."
        : promo && htk
          ? "PDR과 HTK 상품안을 모두 생성했습니다."
          : promo
            ? `PDR은 생성됐지만 HTK 상품안 생성에 실패했습니다: ${htkError}`
            : `HTK 상품안은 생성됐지만 PDR 생성에 실패했습니다: ${promoError}`,
      // 기존 화면과의 호환
      sheetName: promo?.sheetName ?? "",
      sheetId: promo?.sheetId ?? null,
      sheetUrl: promo?.sheetUrl ?? "",
    });
  } catch (error) {
    console.error("PDR 생성 요청 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

// 서비스 계정 인증은 두 가지 방식을 지원합니다.
// - 로컬 개발: GOOGLE_SERVICE_ACCOUNT_FILE (프로젝트 루트의 json 키파일 경로)
// - Vercel 등 git 기반 배포: GOOGLE_SERVICE_ACCOUNT_JSON (키파일 내용을 그대로
//   환경변수에 넣음) — 배포 환경에는 json 키파일이 git에 올라가지 않으므로 필요합니다.
function createGoogleAuth(
  serviceAccountJson?: string,
  serviceAccountFile?: string,
) {
  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
  ];

  if (serviceAccountJson) {
    let credentials: Record<string, unknown>;

    try {
      credentials = JSON.parse(
        serviceAccountJson,
      );
    } catch {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON 값이 올바른 JSON 형식이 아닙니다.",
      );
    }

    return new google.auth.GoogleAuth({
      credentials,
      scopes,
    });
  }

  return new google.auth.GoogleAuth({
    keyFile: path.join(
      process.cwd(),
      serviceAccountFile!,
    ),
    scopes,
  });
}

function isLivePromotion(
  value?: string,
) {
  // 프론트에서는 "라이브"/"기획전"(한글)로 보내지만,
  // 혹시 영문 값이 들어오는 경우도 함께 처리합니다.
  return (
    value === "라이브" ||
    value === "live"
  );
}

// "7.14" 처럼 앞자리 0 없이 월.일 형식으로 만듭니다.
function formatMonthDot(
  value?: string,
) {
  if (!value) {
    return "";
  }

  const datePart = value.split(" ")[0];
  const parts = datePart.split("-");

  if (parts.length !== 3) {
    return "";
  }

  return `${Number(parts[1])}.${Number(parts[2])}`;
}

// 탭 이름 기본값: "시작일_항공사명_라이브/기획전" (예: "7.14_아시아나항공_라이브")
function buildDefaultSheetName(
  body: CreatePdrRequest,
) {
  const isLive = isLivePromotion(
    body.promotionType,
  );

  const dateLabel = formatMonthDot(
    (isLive
      ? body.liveStart || body.saleStart
      : body.saleStart || body.liveStart) ??
      "",
  );

  const typeLabel = isLive
    ? "라이브"
    : "기획전";

  return [
    dateLabel,
    body.airline || "항공사",
    typeLabel,
  ]
    .filter(Boolean)
    .join(" ");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return String(error || "알 수 없는 오류");
}

type PromoCreateParams = {
  sheets: ReturnType<typeof google.sheets>;
  spreadsheetId: string;
  templateSheetName: string;
  body: CreatePdrRequest;
};

type CreateResult = {
  sheetName: string;
  sheetId: number;
  sheetUrl: string;
};

async function createPromoPdr({
  sheets,
  spreadsheetId,
  templateSheetName,
  body,
}: PromoCreateParams): Promise<CreateResult> {
  const spreadsheet =
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields:
        "spreadsheetId,sheets.properties",
    });

  const allSheets =
    spreadsheet.data.sheets ??
    [];

  const templateSheet =
    allSheets.find(
      (sheet) =>
        sheet.properties
          ?.title ===
        templateSheetName,
    );

  const templateSheetId =
    templateSheet
      ?.properties?.sheetId;

  const templateSheetIndex =
    templateSheet
      ?.properties?.index;

  if (
    templateSheetId == null ||
    templateSheetIndex == null
  ) {
    throw new Error(
      `${templateSheetName} 탭을 찾지 못했습니다.`,
    );
  }

  const baseSheetName =
    createSafeSheetName(
      body.sheetName?.trim() ||
        buildDefaultSheetName(body),
    );

  const existingNames =
    new Set(
      allSheets
        .map(
          (sheet) =>
            sheet.properties
              ?.title,
        )
        .filter(
          (
            title,
          ): title is string =>
            typeof title ===
            "string",
        ),
    );

  const finalSheetName =
    createUniqueSheetName(
      baseSheetName,
      existingNames,
    );

  const duplicateResponse =
    await sheets.spreadsheets.batchUpdate(
      {
        spreadsheetId,
        requestBody: {
          requests: [
            {
              duplicateSheet: {
                sourceSheetId:
                  templateSheetId,
                insertSheetIndex:
                  templateSheetIndex + 1,
                newSheetName:
                  finalSheetName,
              },
            },
          ],
        },
      },
    );

  const createdSheetId =
    duplicateResponse.data
      .replies?.[0]
      ?.duplicateSheet
      ?.properties?.sheetId;

  if (createdSheetId == null) {
    throw new Error(
      "PDR 탭 생성 결과를 확인하지 못했습니다.",
    );
  }

  const isLive = isLivePromotion(
    body.promotionType,
  );

  // 기획전은 "사전 알림"·"라이브" 일시 행이 필요 없으므로 지워서
  // "출발 기간"이 위로 당겨지게 합니다. 뒤(더 아래)에 있는 행부터
  // 지워야 앞에 있는 행의 인덱스가 흔들리지 않습니다.
  if (!isLive) {
    const overviewRows =
      await findSectionRows({
        sheets,
        spreadsheetId,
        sheetName: finalSheetName,
        sectionTitles: [
          "사전 알림",
          "라이브",
        ],
      });

    const overviewRowsToDelete = [
      overviewRows["사전 알림"],
      overviewRows["라이브"],
    ]
      .filter(
        (row): row is number =>
          Boolean(row),
      )
      .sort((a, b) => b - a);

    if (overviewRowsToDelete.length > 0) {
      await sheets.spreadsheets.batchUpdate(
        {
          spreadsheetId,
          requestBody: {
            requests:
              overviewRowsToDelete.map(
                (row) => ({
                  deleteDimension: {
                    range: {
                      sheetId:
                        createdSheetId,
                      dimension: "ROWS",
                      startIndex:
                        row - 1,
                      endIndex: row,
                    },
                  },
                }),
              ),
          },
        },
      );
    }
  }

  // 기획전은 "라이브 혜택"·"라이브 경품"·"구매 혜택" 섹션이 필요 없으므로,
  // 템플릿에서 해당 행들을 통째로 지워서 "항공사 강조" 이하가 위로
  // 당겨지게 합니다(별도 기획전 전용 템플릿 없이 처리).
  if (!isLive) {
    const liveSectionRows =
      await findSectionRows({
        sheets,
        spreadsheetId,
        sheetName: finalSheetName,
        sectionTitles: [
          "라이브 혜택",
          "항공사 강조",
        ],
      });

    const liveStartRow =
      liveSectionRows["라이브 혜택"];
    const airlineSectionRow =
      liveSectionRows["항공사 강조"];

    if (
      liveStartRow &&
      airlineSectionRow &&
      airlineSectionRow > liveStartRow
    ) {
      await sheets.spreadsheets.batchUpdate(
        {
          spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId:
                      createdSheetId,
                    dimension: "ROWS",
                    startIndex:
                      liveStartRow - 1,
                    endIndex:
                      airlineSectionRow -
                      1,
                  },
                },
              },
            ],
          },
        },
      );
    }
  }

  const routes =
    body.routes ?? [];

  const highlightedRoutes =
    routes.filter(
      (route) =>
        route.highlighted,
    );

  const allSections: SectionDefinition[] =
    [
      {
        title:
          "라이브 혜택",
        columnCount: 5,
        values: (
          body.liveBenefits ??
          []
        ).map(
          createBenefitRow,
        ),
      },
      {
        title:
          "라이브 경품",
        columnCount: 5,
        values: (
          body.liveGifts ?? []
        ).map(createGiftRow),
      },
      {
        title: "구매 혜택",
        columnCount: 5,
        values: (
          body.purchaseBenefits ??
          []
        ).map(
          createBenefitRow,
        ),
      },
      {
        title: "항공사 강조",
        columnCount: 5,
        values: (
          body.airlineHighlights ??
          []
        ).map(
          createAirlineHighlightRow,
        ),
      },
      {
        title: "강조 노선",
        columnCount: 5,
        values:
          highlightedRoutes.map(
            (route) => {
              const copy =
                createDestinationCopy(
                  cleanText(
                    route.arrivalCode ??
                      "",
                  ),
                  cleanText(
                    route.arrivalCity ??
                      "",
                  ),
                );

              return [
                cleanText(
                  route.departureCode ??
                    "",
                ),
                cleanText(
                  route.arrivalCode ??
                    "",
                ),
                cleanText(
                  route.arrivalCity ??
                    "",
                ),
                copy.main,
                copy.sub,
              ];
            },
          ),
      },
      {
        title: "전체 노선",
        columnCount: 4,
        // 출발 공항 → 권역 → 도착 공항 순으로 정렬한 뒤 적습니다
        // (원래 입력 순서는 뒤섞여 있을 수 있음).
        values: [...routes]
          .sort((a, b) => {
            const departure =
              (a.departureCode ?? "").localeCompare(
                b.departureCode ?? "",
              );
            if (departure !== 0) {
              return departure;
            }

            const region =
              (a.region ?? "").localeCompare(
                b.region ?? "",
                "ko",
              );
            if (region !== 0) {
              return region;
            }

            return (
              a.arrivalCode ?? ""
            ).localeCompare(
              b.arrivalCode ?? "",
            );
          })
          .map((route) => [
            cleanText(
              route.region ?? "",
            ),
            cleanText(
              route.departureCode ??
                "",
            ),
            cleanText(
              route.arrivalCode ??
                "",
            ),
            cleanText(
              route.price ?? "",
            ),
          ]),
      },
    ];

  const liveOnlySectionTitles = new Set([
    "라이브 혜택",
    "라이브 경품",
    "구매 혜택",
  ]);

  const sections: SectionDefinition[] =
    isLive
      ? allSections
      : allSections.filter(
          (section) =>
            !liveOnlySectionTitles.has(
              section.title,
            ),
        );

  const initialRows =
    await findSectionRows({
      sheets,
      spreadsheetId,
      sheetName:
        finalSheetName,
      sectionTitles:
        sections.map(
          (section) =>
            section.title,
        ),
    });

  const insertRequests: Array<{
    insertDimension: {
      range: {
        sheetId: number;
        dimension: "ROWS";
        startIndex: number;
        endIndex: number;
      };
      inheritFromBefore: boolean;
    };
  }> = [];

  for (
    let index =
      sections.length - 2;
    index >= 0;
    index -= 1
  ) {
    const section =
      sections[index];
    const nextSection =
      sections[index + 1];

    const titleRow =
      initialRows[
        section.title
      ];
    const nextTitleRow =
      initialRows[
        nextSection.title
      ];

    if (
      !titleRow ||
      !nextTitleRow
    ) {
      throw new Error(
        `"${section.title}" 또는 "${nextSection.title}" 섹션을 찾지 못했습니다.`,
      );
    }

    const currentRowsBetween =
      nextTitleRow -
      (titleRow + 2);

    const requiredRowsBetween =
      Math.max(
        section.values.length,
        1,
      ) + 2;

    const rowsToInsert =
      Math.max(
        requiredRowsBetween -
          currentRowsBetween,
        0,
      );

    if (
      rowsToInsert === 0
    ) {
      continue;
    }

    insertRequests.push({
      insertDimension: {
        range: {
          sheetId:
            createdSheetId,
          dimension: "ROWS",
          startIndex:
            nextTitleRow - 1,
          endIndex:
            nextTitleRow -
            1 +
            rowsToInsert,
        },
        inheritFromBefore: true,
      },
    });
  }

  if (
    insertRequests.length >
    0
  ) {
    await sheets.spreadsheets.batchUpdate(
      {
        spreadsheetId,
        requestBody: {
          requests:
            insertRequests,
        },
      },
    );
  }

  const finalRows =
    await findSectionRows({
      sheets,
      spreadsheetId,
      sheetName:
        finalSheetName,
      sectionTitles:
        sections.map(
          (section) =>
            section.title,
        ),
    });

  const escapedSheetName =
    escapeSheetName(
      finalSheetName,
    );

  const valueRanges: Array<{
    range: string;
    values: string[][];
  }> = [
    {
      range: `'${escapedSheetName}'!A1`,
      // 맨 위 큰 제목은 "프로모션 제목"(B4)과 별개로, 탭 이름과
      // 통일해서 "8.11 아시아나항공 기획전" 형태로 보여줍니다.
      values: [[baseSheetName]],
    },
    {
      range: isLive
        ? `'${escapedSheetName}'!B4:B9`
        : `'${escapedSheetName}'!B4:B7`,
      values: isLive
        ? [
            [
              [body.airline, body.promotionName]
                .map((value) => cleanText(value ?? ""))
                .filter(Boolean)
                .join(" "),
            ],
            [
              cleanText(
                body.subtitle ?? "",
              ),
            ],
            [
              formatDateRange(
                body.saleStart,
                body.saleEnd,
              ),
            ],
            [
              formatDateRange(
                body.preNotificationStart,
                body.preNotificationEnd,
              ),
            ],
            [
              formatLiveDateTime(
                body.liveStart,
              ),
            ],
            [
              formatDateRange(
                body.travelStart,
                body.travelEnd,
              ),
            ],
          ]
        : [
            [
              [body.airline, body.promotionName]
                .map((value) => cleanText(value ?? ""))
                .filter(Boolean)
                .join(" "),
            ],
            [
              cleanText(
                body.subtitle ?? "",
              ),
            ],
            [
              formatDateRange(
                body.saleStart,
                body.saleEnd,
              ),
            ],
            [
              formatDateRange(
                body.travelStart,
                body.travelEnd,
              ),
            ],
          ],
    },
  ];

  for (const section of sections) {
    if (
      section.values.length ===
      0
    ) {
      continue;
    }

    const titleRow =
      finalRows[
        section.title
      ];

    if (!titleRow) {
      throw new Error(
        `"${section.title}" 섹션 위치를 찾지 못했습니다.`,
      );
    }

    const startRow =
      titleRow + 2;

    const endRow =
      startRow +
      section.values.length -
      1;

    valueRanges.push({
      range:
        `'${escapedSheetName}'!A${startRow}:` +
        `${columnNumberToLetter(
          section.columnCount,
        )}${endRow}`,
      values:
        section.values,
    });
  }

  await sheets.spreadsheets.values.batchUpdate(
    {
      spreadsheetId,
      requestBody: {
        valueInputOption:
          "USER_ENTERED",
        data: valueRanges,
      },
    },
  );

  return {
    sheetName: finalSheetName,
    sheetId: createdSheetId,
    sheetUrl:
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${createdSheetId}`,
  };
}

type HtkCreateParams = {
  sheets: ReturnType<
    typeof google.sheets
  >;
  spreadsheetId: string;
  templateSheetName: string;
  body: CreatePdrRequest;
};

type HtkCreateResult = {
  sheetName: string;
  sheetId: number;
  sheetUrl: string;
};

async function createHtkPdr({
  sheets,
  spreadsheetId,
  templateSheetName,
  body,
}: HtkCreateParams): Promise<HtkCreateResult> {
  const spreadsheet =
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields:
        "spreadsheetId,sheets.properties",
    });

  const allSheets =
    spreadsheet.data.sheets ?? [];

  const templateSheet =
    allSheets.find(
      (sheet) =>
        sheet.properties?.title ===
        templateSheetName,
    );

  const templateSheetId =
    templateSheet?.properties?.sheetId;
  const templateSheetIndex =
    templateSheet?.properties?.index;

  if (
    templateSheetId == null ||
    templateSheetIndex == null
  ) {
    throw new Error(
      `HTK 파일에서 ${templateSheetName} 탭을 찾지 못했습니다.`,
    );
  }

  const existingNames = new Set(
    allSheets
      .map(
        (sheet) =>
          sheet.properties?.title,
      )
      .filter(
        (title): title is string =>
          typeof title === "string",
      ),
  );

  const baseSheetName =
    createSafeSheetName(
      body.sheetName?.trim() ||
        buildDefaultSheetName(body),
    );

  const finalSheetName =
    createUniqueSheetName(
      baseSheetName,
      existingNames,
    );

  const duplicateResponse =
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId:
                templateSheetId,
              insertSheetIndex:
                templateSheetIndex + 1,
              newSheetName:
                finalSheetName,
            },
          },
        ],
      },
    });

  const createdSheetId =
    duplicateResponse.data.replies?.[0]
      ?.duplicateSheet?.properties
      ?.sheetId;

  if (createdSheetId == null) {
    throw new Error(
      "HTK PDR 탭 생성 결과를 확인하지 못했습니다.",
    );
  }

  const escapedSheetName =
    escapeSheetName(finalSheetName);

  const templateValuesResponse =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range:
        `'${escapedSheetName}'!A1:E200`,
    });

  const templateValues =
    templateValuesResponse.data.values ?? [];

  const updates: Array<{
    range: string;
    values: string[][];
  }> = [];

  // 맨 위 큰 제목은 PDR(프모페)과 통일해서 탭 이름과 같은 값으로
  // 보여줍니다(예: "8.11 진에어 라이브").
  updates.push({
    range:
      `'${escapedSheetName}'!A1`,
    values: [[baseSheetName]],
  });

  const overviewValues: Record<
    string,
    string
  > = {
    // PDR(프모페)의 "프로모션 제목" 셀과 동일한 형식으로 맞춥니다.
    "프로모션 명": [
      body.airline,
      body.promotionName,
    ]
      .map((value) =>
        cleanText(value ?? ""),
      )
      .filter(Boolean)
      .join(" "),
    부제: cleanText(body.subtitle ?? ""),
    "본 프로모션 기간":
      formatDateRange(
        body.saleStart,
        body.saleEnd,
      ),
    "ㄴ 사전 알림":
      formatDateRange(
        body.preNotificationStart,
        body.preNotificationEnd,
      ),
    "사전 알림":
      formatDateRange(
        body.preNotificationStart,
        body.preNotificationEnd,
      ),
    "ㄴ 라이브":
      formatLiveDateTime(
        body.liveStart,
      ),
    라이브:
      formatLiveDateTime(
        body.liveStart,
      ),
    "출발 기간":
      formatDateRange(
        body.travelStart,
        body.travelEnd,
      ),
  };

  for (const [label, value] of
    Object.entries(overviewValues)) {
    const position = findCellPosition(
      templateValues,
      label,
    );

    if (!position) {
      continue;
    }

    updates.push({
      range:
        `'${escapedSheetName}'!${columnNumberToLetter(
          position.column + 2,
        )}${position.row + 1}`,
      values: [[value]],
    });
  }

  const routes = body.routes ?? [];
  const highlightedRoutes =
    routes.filter(
      (route) => route.highlighted,
    );

  const highlightSection =
    findCellPosition(
      templateValues,
      "강조 노선",
    );

  if (highlightSection) {
    const normalHighlighted =
      highlightedRoutes
        .filter(
          (route) =>
            !isRegionalDeparture(
              route.departureCode,
            ),
        )
        .map(formatRouteForHtk)
        .join(", ");

    const regionalHighlighted =
      highlightedRoutes
        .filter((route) =>
          isRegionalDeparture(
            route.departureCode,
          ),
        )
        .map(formatRouteForHtk)
        .join(", ");

    const startRow =
      highlightSection.row + 2;

    updates.push({
      range:
        `'${escapedSheetName}'!A${startRow}:B${
          startRow + 2
        }`,
      values: [
        [
          "[기본 초점]",
          normalHighlighted || "없음",
        ],
        [
          "[지방 출발 추천]",
          regionalHighlighted || "없음",
        ],
        [
          "[특가 노선]",
          highlightedRoutes
            .map(formatRouteForHtk)
            .join(", ") || "없음",
        ],
      ],
    });
  }

  const benefitSection =
    findCellPosition(
      templateValues,
      "혜택 스킴",
    );

  if (benefitSection) {
    const startRow =
      benefitSection.row + 2;

    updates.push({
      range:
        `'${escapedSheetName}'!A${startRow}:B${
          startRow + 2
        }`,
      values: [
        [
          "공통 라이브 특전",
          formatBenefitsForHtk(
            body.liveBenefits,
          ),
        ],
        [
          "라이브 퀴즈 참여 시 경품",
          formatGiftsForHtk(
            body.liveGifts,
          ),
        ],
        [
          "특가 기간 구매 시 혜택",
          formatBenefitsForHtk(
            body.purchaseBenefits,
          ),
        ],
      ],
    });
  }

  const requestSection =
    findCellPosition(
      templateValues,
      "항공사 요청 사항",
    );

  if (requestSection) {
    const requestText =
      (body.airlineHighlights ?? [])
        .map(
          (item, index) =>
            `${index + 1}. ${cleanText(item)}`,
        )
        .filter(
          (item) =>
            !item.endsWith(". "),
        )
        .join("\n") || "없음";

    updates.push({
      range:
        `'${escapedSheetName}'!A${
          requestSection.row + 2
        }:E${requestSection.row + 5}`,
      values: [[requestText]],
    });
  }

  const routeHeaderRow =
    findHeaderRow(
      templateValues,
      ["권역", "출발공항", "도착공항"],
    );

  if (routeHeaderRow !== null) {
    // 출발 공항 → 권역 → 도착 공항 순으로 정렬한 뒤 적습니다
    // (원래 입력 순서는 뒤섞여 있을 수 있음).
    const routeValues = [...routes]
      .sort((a, b) => {
        const departure =
          (a.departureCode ?? "").localeCompare(
            b.departureCode ?? "",
          );
        if (departure !== 0) {
          return departure;
        }

        const region =
          (a.region ?? "").localeCompare(
            b.region ?? "",
            "ko",
          );
        if (region !== 0) {
          return region;
        }

        return (
          a.arrivalCode ?? ""
        ).localeCompare(
          b.arrivalCode ?? "",
        );
      })
      .map((route) => [
        cleanText(route.region ?? ""),
        formatAirportCell(
          route.departureCode ?? "",
          getDepartureCity(
            route.departureCode ?? "",
          ),
        ),
        formatAirportCell(
          route.arrivalCode ?? "",
          route.arrivalCity ?? "",
        ),
      ]);

    if (routeValues.length > 0) {
      const startRow =
        routeHeaderRow + 2;
      const endRow =
        startRow +
        routeValues.length - 1;

      updates.push({
        range:
          `'${escapedSheetName}'!A${startRow}:C${endRow}`,
        values: routeValues,
      });
    }
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption:
          "USER_ENTERED",
        data: updates,
      },
    });
  }

  return {
    sheetName: finalSheetName,
    sheetId: createdSheetId,
    sheetUrl:
      `https://docs.google.com/spreadsheets/d/` +
      `${spreadsheetId}/edit#gid=${createdSheetId}`,
  };
}

function findCellPosition(
  values: string[][],
  target: string,
): {
  row: number;
  column: number;
} | null {
  const normalizedTarget =
    normalizeLabel(target);

  for (
    let row = 0;
    row < values.length;
    row += 1
  ) {
    for (
      let column = 0;
      column < values[row].length;
      column += 1
    ) {
      if (
        normalizeLabel(
          values[row][column] ?? "",
        ) === normalizedTarget
      ) {
        return { row, column };
      }
    }
  }

  return null;
}

function findHeaderRow(
  values: string[][],
  labels: string[],
): number | null {
  const normalizedLabels =
    labels.map(normalizeLabel);

  for (
    let row = 0;
    row < values.length;
    row += 1
  ) {
    const rowLabels = values[row].map(
      normalizeLabel,
    );

    if (
      normalizedLabels.every(
        (label) =>
          rowLabels.includes(label),
      )
    ) {
      return row;
    }
  }

  return null;
}

function normalizeLabel(
  value: string,
) {
  return cleanText(value)
    .replace(/\s+/g, "")
    .replace(/[■□▪▫]/g, "")
    .replace(/[\[\]【】]/g, "");
}

function formatRouteForHtk(
  route: RouteItem,
) {
  const departure =
    cleanText(
      route.departureCode ?? "",
    );
  const arrival =
    cleanText(
      route.arrivalCode ?? "",
    );

  return departure && arrival
    ? `${departure}-${arrival}`
    : arrival || departure;
}

function formatBenefitsForHtk(
  items?: BenefitItem[],
) {
  return (
    (items ?? [])
      .map((item) => {
        const category =
          cleanText(
            item.category ?? "",
          );
        const name = cleanText(
          item.name ?? "",
        );

        return category
          ? `${category}: ${name}`
          : name;
      })
      .filter(Boolean)
      .join("\n") || "없음"
  );
}

function formatGiftsForHtk(
  items?: GiftItem[],
) {
  return (
    (items ?? [])
      .map((item) => {
        const category =
          cleanText(
            item.category ?? "",
          );
        const name = cleanText(
          item.name ?? "",
        );
        const quantity =
          cleanText(
            item.quantity ?? "",
          );
        const gift = [
          name,
          quantity,
        ]
          .filter(Boolean)
          .join(" ");

        return category
          ? `${category}: ${gift}`
          : gift;
      })
      .filter(Boolean)
      .join("\n") || "없음"
  );
}

function isRegionalDeparture(
  code?: string,
) {
  const normalized =
    cleanText(code ?? "")
      .toUpperCase();

  return Boolean(normalized) &&
    !["ICN", "GMP"].includes(
      normalized,
    );
}

function getDepartureCity(
  code: string,
) {
  const cities: Record<
    string,
    string
  > = {
    ICN: "인천",
    GMP: "김포",
    PUS: "부산",
    TAE: "대구",
    CJJ: "청주",
    CJU: "제주",
  };

  return (
    cities[
      cleanText(code).toUpperCase()
    ] ?? ""
  );
}

function formatAirportCell(
  code: string,
  city: string,
) {
  const normalizedCode =
    cleanText(code).toUpperCase();
  const normalizedCity =
    cleanText(city);

  if (
    normalizedCity &&
    normalizedCode
  ) {
    return `${normalizedCity} (${normalizedCode})`;
  }

  return normalizedCity ||
    normalizedCode;
}

function createBenefitRow(
  item: BenefitItem,
): string[] {
  const category =
    cleanText(
      item.category ?? "",
    );
  const name = cleanText(
    item.name ?? "",
  );

  return [
    category,
    name,
    "",
    createBenefitMainCopy(
      category,
      name,
    ),
    createBenefitSubCopy(
      category,
      name,
    ),
  ];
}

function createGiftRow(
  item: GiftItem,
): string[] {
  const category =
    cleanText(
      item.category ?? "",
    );
  const name = cleanText(
    item.name ?? "",
  );
  const quantity =
    cleanText(
      item.quantity ?? "",
    );

  return [
    category,
    name,
    quantity,
    quantity
      ? `${name} ${quantity} 증정`
      : name,
    quantity
      ? `라이브 참여 고객 중 ${quantity}을 추첨해 ${name}을 드려요.`
      : `라이브 참여 고객을 위한 ${name} 경품을 만나보세요.`,
  ];
}

function createAirlineHighlightRow(
  value: string,
): string[] {
  const content =
    cleanText(value);

  return [
    createHighlightTitle(
      content,
    ),
    content,
    "",
    createHighlightMainCopy(
      content,
    ),
    createHighlightSubCopy(
      content,
    ),
  ];
}

function createBenefitMainCopy(
  category: string,
  name: string,
) {
  if (
    category ===
    "발권수수료"
  ) {
    const amount =
      name.match(
        /\d+(?:\.\d+)?만원|\d{1,3}(?:,\d{3})+원/,
      )?.[0] ?? "";

    return amount
      ? `발권수수료 ${amount} 면제`
      : "발권수수료 면제";
  }

  if (
    category === "이심"
  ) {
    const percent =
      name.match(
        /\d{1,3}%/,
      )?.[0];

    return percent
      ? `eSIM ${percent} 할인`
      : "eSIM 할인 혜택";
  }

  if (
    category === "카드"
  ) {
    const percent =
      name.match(
        /(최대\s*)?\d{1,3}%/,
      )?.[0];

    return percent
      ? `제휴 카드 ${percent} 할인`
      : name;
  }

  return name;
}

function createBenefitSubCopy(
  category: string,
  name: string,
) {
  const copies: Record<
    string,
    string
  > = {
    카드:
      "여행 비용을 더 가볍게 줄여보세요.",
    숙소:
      "여행지에서의 숙박까지 합리적으로 준비하세요.",
    이심:
      "해외에서도 데이터 걱정 없이 여행하세요.",
    와이파이:
      "여행 중에도 자유롭게 인터넷을 이용해보세요.",
    교통:
      "공항부터 여행지까지 이동을 더욱 편하게 준비하세요.",
    라운지:
      "출발 전 공항에서 여유로운 시간을 보내보세요.",
    상품권:
      "여행에 바로 사용할 수 있는 특별한 혜택을 만나보세요.",
    투어상품:
      "현지에서 즐길 특별한 여행 경험을 준비하세요.",
    쿠폰:
      "여행 준비에 유용한 할인 혜택을 만나보세요.",
    구독:
      "여행 전 필요한 서비스를 합리적으로 이용해보세요.",
    할인:
      "여행 비용의 부담을 줄여보세요.",
    발권수수료:
      "추가 비용 부담 없이 항공권을 더욱 합리적으로 예약하세요.",
    기타:
      "여행 준비에 유용한 특별한 혜택을 만나보세요.",
  };

  return (
    copies[category] ||
    (name
      ? "여행 준비에 유용한 특별한 혜택을 만나보세요."
      : "")
  );
}

function createHighlightTitle(
  content: string,
) {
  if (
    /수하물/.test(
      content,
    )
  ) {
    return "수하물";
  }

  if (
    /터미널/.test(
      content,
    )
  ) {
    return "공항 이용";
  }

  if (
    /운항|증편/.test(
      content,
    )
  ) {
    return "운항 편의";
  }

  return "항공사 서비스";
}

function createHighlightMainCopy(
  content: string,
) {
  if (
    /수하물/.test(
      content,
    )
  ) {
    const weight =
      content.match(
        /\d+\s*KG/i,
      )?.[0];

    return weight
      ? `위탁 수하물 ${weight.toUpperCase()} 포함`
      : "무료 위탁 수하물 포함";
  }

  if (
    /터미널/.test(
      content,
    )
  ) {
    return "더 편리한 공항 이용";
  }

  if (
    /매일\s*운항|데일리/.test(
      content,
    )
  ) {
    return "매일 만나는 편리한 항공편";
  }

  return content;
}

function createHighlightSubCopy(
  content: string,
) {
  if (
    /수하물/.test(
      content,
    )
  ) {
    return "추가 비용 걱정 없이 여행 짐을 여유롭게 준비하세요.";
  }

  if (
    /터미널/.test(
      content,
    )
  ) {
    return "쾌적하고 빠른 수속으로 여행을 시작하세요.";
  }

  if (
    /운항|증편/.test(
      content,
    )
  ) {
    return "더 다양한 일정으로 여행을 편리하게 계획해보세요.";
  }

  return "항공사만의 서비스와 함께 더욱 편안하게 여행하세요.";
}

function createDestinationCopy(
  code: string,
  city: string,
): {
  main: string;
  sub: string;
} {
  const copies: Record<
    string,
    {
      main: string;
      sub: string;
      // 같은 목적지라도 생성할 때마다 다른 스팟을 언급할 수 있도록
      // 준비해둔 두 번째 서브 문구입니다 (없으면 sub만 씁니다).
      subAlt?: string;
    }
  > = {
    UKB: {
      main:
        "항구의 낭만과 고베규 미식 여행",
      sub:
        "바다를 따라 펼쳐지는 야경과 고베규의 깊은 풍미를 함께 만나보세요.",
    },
    FUK: {
      main:
        "포장마차와 온천을 즐기는 미식 여행",
      sub:
        "하카타의 활기찬 밤거리부터 근교 온천의 여유까지 후쿠오카를 알차게 즐겨보세요.",
      subAlt:
        "다자이후 텐만구의 고즈넉함과 야타이 포장마차의 정겨움을 함께 느껴보세요.",
    },
    TAK: {
      main:
        "예술의 섬으로 이어지는 감성 여행",
      sub:
        "고즈넉한 골목과 세토내해의 예술섬을 오가며 다카마쓰의 여유를 느껴보세요.",
    },
    NRT: {
      main:
        "취향 따라 발견하는 도쿄 여행",
      sub:
        "개성 있는 동네와 다채로운 미식, 쇼핑을 따라 도쿄의 새로운 매력을 만나보세요.",
      subAlt:
        "시부야의 활기와 아사쿠사 센소지의 고즈넉함을 오가며 도쿄의 또 다른 얼굴을 만나보세요.",
    },
    KIX: {
      main:
        "먹거리와 활기가 가득한 오사카",
      sub:
        "도톤보리의 화려한 야경과 풍성한 미식을 따라 오사카를 신나게 즐겨보세요.",
      subAlt:
        "오사카성의 웅장함과 신사이바시 상점가의 활기를 함께 느껴보세요.",
    },
    CTS: {
      main:
        "자연과 미식이 기다리는 삿포로",
      sub:
        "계절마다 달라지는 북해도의 풍경과 신선한 현지 미식을 함께 즐겨보세요.",
      subAlt:
        "오도리 공원의 낭만과 오타루 운하의 정취를 함께 만나보세요.",
    },
    DAD: {
      main:
        "해변과 근교 명소를 잇는 다낭 여행",
      sub:
        "미케비치의 여유부터 호이안의 낭만까지 다낭의 다채로운 매력을 만나보세요.",
      subAlt:
        "바나힐의 골든브릿지와 오행산의 신비로운 동굴을 함께 만나보세요.",
    },
    CXR: {
      main:
        "맑은 바다에서 쉬어가는 나트랑",
      sub:
        "투명한 바다와 여유로운 리조트에서 편안한 휴양을 즐겨보세요.",
      subAlt:
        "빈펄랜드의 신나는 즐거움과 포나가르 참탑의 이색적인 풍경을 함께 느껴보세요.",
    },
    HAN: {
      main:
        "구시가지와 미식을 걷는 하노이",
      sub:
        "오랜 시간이 쌓인 골목과 향긋한 현지 음식을 따라 하노이의 일상을 만나보세요.",
      subAlt:
        "호안끼엠 호수의 낭만과 호치민 영묘 주변의 고즈넉함을 함께 즐겨보세요.",
    },
    SGN: {
      main:
        "도시의 에너지를 만나는 호치민",
      sub:
        "프렌치 감성의 건축과 활기찬 거리, 다채로운 미식을 함께 즐겨보세요.",
      subAlt:
        "벤탄시장의 활기와 노트르담 성당 주변 거리를 함께 걸어보세요.",
    },
    PQC: {
      main:
        "선셋과 바다가 기다리는 푸꾸옥",
      sub:
        "맑은 바다와 느긋한 석양을 바라보며 온전한 휴식을 즐겨보세요.",
      subAlt:
        "빈원더스의 신나는 액티비티와 케이블카에서 내려다보는 절경을 함께 만나보세요.",
    },
    BKK: {
      main:
        "사원과 야시장을 즐기는 방콕",
      sub:
        "화려한 사원부터 현지 미식과 야시장까지 방콕의 에너지를 경험해보세요.",
      subAlt:
        "왓아룬의 웅장함과 카오산로드의 활기찬 밤거리를 함께 느껴보세요.",
    },
    CNX: {
      main:
        "고요한 사원과 자연의 치앙마이",
      sub:
        "오래된 사원과 초록빛 자연 속에서 치앙마이만의 느긋한 시간을 보내보세요.",
      subAlt:
        "왓프라탓 도이수텝의 전망과 님만해민 거리의 감성 카페를 함께 즐겨보세요.",
    },
    DPS: {
      main:
        "자연과 감성이 어우러진 발리",
      sub:
        "울창한 자연과 아름다운 해변, 감각적인 리조트에서 특별한 시간을 보내보세요.",
      subAlt:
        "우붓의 초록빛 계단식 논과 울루와뚜 절벽 사원의 노을을 함께 만나보세요.",
    },
    GUM: {
      main:
        "가까이에서 만나는 푸른 휴양지",
      sub:
        "투명한 바다와 여유로운 리조트에서 완벽한 휴식을 즐겨보세요.",
      subAlt:
        "투몬비치의 화려한 야경과 스타샌즈 브릿지의 낭만을 함께 느껴보세요.",
    },
    TPE: {
      main:
        "야시장과 골목 미식의 타이베이",
      sub:
        "활기찬 야시장과 오래된 골목을 따라 타이베이의 다채로운 맛을 만나보세요.",
      subAlt:
        "타이베이101의 전망과 지우펀의 골목 정취를 함께 즐겨보세요.",
    },
    HKG: {
      main:
        "야경과 미식이 빛나는 홍콩",
      sub:
        "화려한 스카이라인과 딤섬, 개성 있는 골목을 따라 홍콩을 즐겨보세요.",
      subAlt:
        "빅토리아 피크의 야경과 몽콕 야시장의 활기를 함께 만나보세요.",
    },
    CDG: {
      main:
        "예술과 낭만을 걷는 파리",
      sub:
        "고전적인 거리와 미술관, 카페의 여유를 따라 파리의 감성을 만나보세요.",
      subAlt:
        "에펠탑의 낭만과 몽마르뜨 언덕의 예술적 분위기를 함께 느껴보세요.",
    },
    FCO: {
      main:
        "시간을 거슬러 걷는 로마",
      sub:
        "고대 유적과 활기찬 광장, 풍성한 이탈리아 미식을 함께 즐겨보세요.",
      subAlt:
        "콜로세움의 웅장함과 트레비 분수의 낭만을 함께 만나보세요.",
    },
    LHR: {
      main:
        "클래식과 트렌드가 만나는 런던",
      sub:
        "오랜 역사와 현대적인 문화가 공존하는 런던의 다채로운 매력을 만나보세요.",
      subAlt:
        "빅벤과 타워브릿지의 클래식한 풍경을 함께 즐겨보세요.",
    },
    JFK: {
      main:
        "브로드웨이와 스카이라인의 뉴욕",
      sub:
        "화려한 공연과 도시의 에너지를 따라 뉴욕에서 잊지 못할 하루를 만들어보세요.",
      subAlt:
        "타임스퀘어의 화려함과 센트럴파크의 여유를 함께 느껴보세요.",
    },
    YVR: {
      main:
        "도시와 대자연을 함께 만나는 밴쿠버",
      sub:
        "세련된 도심과 가까운 산과 바다를 오가며 밴쿠버의 여유를 느껴보세요.",
      subAlt:
        "스탠리파크의 초록빛 산책로와 개스타운의 빈티지한 거리를 함께 즐겨보세요.",
    },
    SYD: {
      main:
        "항구의 풍경이 빛나는 시드니",
      sub:
        "오페라하우스와 아름다운 해변을 따라 시드니의 여유로운 일상을 즐겨보세요.",
      subAlt:
        "하버브릿지의 전망과 본다이비치의 여유를 함께 만나보세요.",
    },

    // 여기서부터는 나중에 추가된 목적지들입니다.
    // 새 공항코드가 AIRPORTS(page.tsx)에 추가될 때마다, 아래 폴백
    // 문구("OO만의 풍경과 미식...")로 방치하지 말고 여기에 그 지역만의
    // 특색을 담은 문구를 계속 채워 넣을 것.
    NGO: {
      main: "성곽과 산업 문화가 공존하는 나고야",
      sub: "나고야성의 고풍스러움과 활기찬 오스 상점가를 오가며 색다른 일본을 만나보세요.",
      subAlt: "아쓰타신궁의 고즈넉함과 데바사키 맛집 투어를 함께 즐겨보세요.",
    },
    OKA: {
      main: "에메랄드빛 바다가 펼쳐지는 오키나와",
      sub: "투명한 바다와 류큐 왕국의 독특한 문화를 함께 즐기며 이국적인 휴양을 만끽해보세요.",
      subAlt: "슈리성의 독특한 역사와 츄라우미 수족관의 감동을 함께 만나보세요.",
    },
    HND: {
      main: "도심에서 가까운 도쿄, 하네다로",
      sub: "시내와 가까운 하네다공항으로 도쿄 여행을 더 빠르고 편하게 시작해보세요.",
    },
    KMJ: {
      main: "성과 자연이 어우러진 구마모토",
      sub: "웅장한 구마모토성과 아소산의 대자연을 오가며 규슈만의 매력을 느껴보세요.",
    },
    HSG: {
      main: "온천과 도자기 마을의 사가",
      sub: "숨은 온천 마을과 유서 깊은 도자기 문화를 따라 조용한 규슈 여행을 즐겨보세요.",
    },
    SHI: {
      main: "투명한 산호빛 바다의 미야코",
      sub: "손꼽히는 청량한 바다와 한적한 섬 풍경 속에서 완벽한 휴양을 누려보세요.",
    },
    KKJ: {
      main: "공업 도시의 재발견, 기타큐슈",
      sub: "모지코 레트로 거리와 야경 명소를 거닐며 색다른 규슈의 매력을 만나보세요.",
    },
    ISG: {
      main: "오키나와 남단, 이시가키의 비경",
      sub: "손꼽히는 투명한 바다와 산호초 스노클링으로 진짜 휴양을 경험해보세요.",
    },
    IBR: {
      main: "도쿄 근교, 이바라키의 여유",
      sub: "히타치 해변공원의 꽃물결과 여유로운 근교 풍경을 만나보세요.",
    },
    OBO: {
      main: "대자연 속 홋카이도, 오비히로",
      sub: "드넓은 목가적 풍경과 신선한 홋카이도 별미를 함께 즐겨보세요.",
    },
    HIJ: {
      main: "평화와 역사를 걷는 히로시마",
      sub: "평화기념공원과 미야지마의 붉은 도리이를 함께 둘러보는 특별한 여정을 만나보세요.",
    },
    YGJ: {
      main: "사구와 온천의 숨은 명소",
      sub: "일본 유일의 대사구와 조용한 온천 마을에서 색다른 휴식을 즐겨보세요.",
    },
    TKS: {
      main: "소용돌이와 전통 춤의 도쿠시마",
      sub: "나루토의 장엄한 소용돌이와 아와오도리 축제의 흥을 함께 느껴보세요.",
    },
    FSZ: {
      main: "후지산이 보이는 시즈오카",
      sub: "웅장한 후지산 전망과 향긋한 녹차밭을 거닐며 여유를 즐겨보세요.",
    },
    MYJ: {
      main: "온천과 성이 있는 마쓰야마",
      sub: "일본 3대 온천 도고온천과 고풍스러운 마쓰야마성을 함께 즐겨보세요.",
    },
    OIT: {
      main: "일본 제일의 온천 도시, 오이타",
      sub: "벳푸·유후인의 명품 온천들을 오가며 진정한 온천 여행을 누려보세요.",
    },
    NGS: {
      main: "이국적 항구 도시, 나가사키",
      sub: "서양과 동양이 어우러진 독특한 풍경과 짬뽕의 원조 미식을 만나보세요.",
    },
    OKJ: {
      main: "복숭아와 정원의 도시 오카야마",
      sub: "일본 3대 정원 고라쿠엔의 운치와 달콤한 특산 과일을 함께 즐겨보세요.",
    },
    KMQ: {
      main: "가가온천으로 가는 관문, 고마쓰",
      sub: "유서 깊은 가가온천 마을에서 전통 료칸의 정취를 느껴보세요.",
    },
    KOJ: {
      main: "활화산이 빚어낸 절경, 가고시마",
      sub: "여전히 연기를 내뿜는 사쿠라지마와 진한 흑돼지 미식을 함께 즐겨보세요.",
    },

    HKT: {
      main: "안다만해의 낭만, 푸켓",
      sub: "에메랄드빛 해변과 다채로운 액티비티로 완벽한 휴양을 즐겨보세요.",
    },
    CGK: {
      main: "인도네시아 최대 도시, 자카르타",
      sub: "역동적인 도심과 다채로운 로컬 문화를 가까이에서 경험해보세요.",
    },
    MNL: {
      main: "스페인 정취가 남은 마닐라",
      sub: "인트라무로스의 옛 정취와 활기찬 도심을 함께 느껴보세요.",
    },
    CEB: {
      main: "산호초 가득한 휴양지, 세부",
      sub: "투명한 바다와 다채로운 해양 액티비티로 완벽한 휴양을 즐겨보세요.",
      subAlt: "산토니뇨 성당의 유서 깊은 역사와 시내 투어를 함께 만나보세요.",
    },
    TAG: {
      main: "초콜릿 힐의 신비, 보홀",
      sub: "독특한 초콜릿 힐 지형과 안경원숭이를 만나는 특별한 여행을 떠나보세요.",
    },
    SIN: {
      main: "미래도시의 감각, 싱가포르",
      sub: "마리나베이의 화려한 스카이라인과 다채로운 미식 문화를 만나보세요.",
      subAlt: "가든스바이더베이의 미래적 풍경과 차이나타운의 정겨운 골목을 함께 즐겨보세요.",
    },
    KUL: {
      main: "쌍둥이 빌딩의 도시, 쿠알라룸푸르",
      sub: "페트로나스 트윈타워의 야경과 다민족이 어우러진 미식을 즐겨보세요.",
      subAlt: "바투 케이브의 이색적인 풍경과 부킷빈탕의 활기찬 거리를 함께 느껴보세요.",
    },
    BKI: {
      main: "석양이 아름다운 코타키나발루",
      sub: "붉게 물드는 바다 노을과 맑은 산호초 바다에서 여유를 만끽해보세요.",
      subAlt: "탄중아루비치의 노을과 만타나니 섬의 투명한 바다를 함께 즐겨보세요.",
    },
    CRK: {
      main: "여유로운 휴양지, 클락",
      sub: "한적한 골프장과 리조트에서 느긋한 휴가를 즐겨보세요.",
    },
    DEL: {
      main: "천년 역사가 살아있는 델리",
      sub: "무굴제국의 유적과 활기찬 시장을 오가며 인도의 진짜 매력을 만나보세요.",
    },

    RMQ: {
      main: "예술과 야시장의 도시, 타이중",
      sub: "감각적인 문화공간과 활기찬 야시장에서 대만 로컬의 삶을 느껴보세요.",
    },
    PVG: {
      main: "동서양이 공존하는 상하이",
      sub: "와이탄의 화려한 스카이라인과 옛 정취가 남은 골목을 함께 즐겨보세요.",
      subAlt: "예원의 고풍스러운 정원과 신천지의 세련된 거리를 함께 느껴보세요.",
    },
    PEK: {
      main: "역사와 현대가 만나는 베이징",
      sub: "웅장한 자금성과 만리장성부터 현대적인 도심까지 폭넓게 즐겨보세요.",
      subAlt: "이허위안의 고즈넉한 정원과 왕푸징 거리의 활기를 함께 만나보세요.",
    },
    TAO: {
      main: "맥주와 해변의 도시, 칭다오",
      sub: "독일풍 거리와 시원한 칭다오 맥주, 해변 산책을 함께 즐겨보세요.",
    },
    SHE: {
      main: "청 왕조의 흔적, 선양",
      sub: "고궁과 능묘 등 유서 깊은 역사 유적을 걸으며 특별한 시간을 보내보세요.",
    },
    WUH: {
      main: "장강이 흐르는 도시, 우한",
      sub: "황학루의 전망과 활기찬 대학 도시의 분위기를 함께 느껴보세요.",
    },
    TNA: {
      main: "샘의 도시, 지난",
      sub: "곳곳에서 솟아나는 맑은 샘물과 고즈넉한 호수 풍경을 즐겨보세요.",
    },
    KHH: {
      main: "항구 도시의 활기, 가오슝",
      sub: "이국적인 항구 야경과 활기찬 야시장에서 대만 남부를 만나보세요.",
    },
    YNJ: {
      main: "조선족 문화가 살아있는 옌지",
      sub: "정겨운 한글 간판과 향토 음식으로 특별한 국경 도시를 만나보세요.",
    },
    YNT: {
      main: "해안 휴양지, 옌타이",
      sub: "청량한 해변과 신선한 해산물로 여유로운 시간을 보내보세요.",
    },
    HUN: {
      main: "협곡이 빚어낸 절경, 화롄",
      sub: "웅장한 타이루거 협곡을 따라 대만 동부의 자연을 만나보세요.",
    },
    WEH: {
      main: "가까운 바다 도시, 웨이하이",
      sub: "깨끗한 해안선과 여유로운 분위기로 짧은 힐링 여행을 즐겨보세요.",
    },
    HRB: {
      main: "이국적 설경의 도시, 하얼빈",
      sub: "러시아풍 건축과 세계적인 빙설제 축제로 특별한 겨울을 만나보세요.",
    },
    PKX: {
      main: "신공항으로 만나는 베이징",
      sub: "최신 다싱공항을 통해 베이징의 역사와 현대를 더 편리하게 즐겨보세요.",
    },
    TSA: {
      main: "시내 중심에서 만나는 타이베이",
      sub: "도심과 가까운 송산공항으로 타이베이 여행을 더 빠르게 시작해보세요.",
    },
    CAN: {
      main: "미식의 도시, 광저우",
      sub: "딤섬의 본고장에서 정통 광둥 요리와 활기찬 야시장을 즐겨보세요.",
    },
    CGO: {
      main: "중원의 중심, 정저우",
      sub: "소림사와 황하의 웅장한 풍경 속에서 중국의 뿌리를 만나보세요.",
    },
    CSX: {
      main: "먹거리 열풍의 도시, 창사",
      sub: "매콤한 후난 요리와 활기찬 야시장 문화로 색다른 미식 여행을 즐겨보세요.",
    },
    DYG: {
      main: "판도라의 실제 배경, 장가계",
      sub: "기암괴석이 만든 웅장한 협곡에서 신비로운 절경을 만나보세요.",
    },
    MFM: {
      main: "동서양이 어우러진 마카오",
      sub: "화려한 카지노 리조트와 포르투갈풍 옛 거리를 함께 즐겨보세요.",
    },
    SZX: {
      main: "혁신 도시, 선전",
      sub: "첨단 스카이라인과 다채로운 테마파크로 색다른 중국을 만나보세요.",
    },

    FRA: {
      main: "유럽의 관문, 프랑크푸르트",
      sub: "고풍스러운 구시가지와 현대적인 스카이라인이 공존하는 도시를 만나보세요.",
    },
    BCN: {
      main: "가우디의 예술 도시, 바르셀로나",
      sub: "사그라다 파밀리아와 지중해의 낭만을 함께 즐겨보세요.",
    },
    AMS: {
      main: "운하 위의 낭만, 암스테르담",
      sub: "고즈넉한 운하와 자전거 거리를 거닐며 여유로운 유럽 감성을 느껴보세요.",
    },
    MXP: {
      main: "패션과 예술의 도시, 밀라노",
      sub: "두오모 대성당의 웅장함과 세계적인 패션 거리를 함께 즐겨보세요.",
    },
    ZRH: {
      main: "알프스의 관문, 취리히",
      sub: "맑은 취리히 호수와 웅장한 알프스 전망을 함께 만나보세요.",
    },
    IST: {
      main: "동서양이 만나는 이스탄불",
      sub: "웅장한 모스크와 활기찬 바자르를 오가며 이색적인 매력을 느껴보세요.",
    },
    MAD: {
      main: "정열의 도시, 마드리드",
      sub: "프라도 미술관의 명작과 활기찬 광장 문화를 함께 즐겨보세요.",
    },
    LIS: {
      main: "언덕 위 파스텔톤, 리스본",
      sub: "노란 트램과 파두 선율이 흐르는 골목에서 낭만을 느껴보세요.",
    },
    PRG: {
      main: "동화 속 도시, 프라하",
      sub: "붉은 지붕과 고성이 어우러진 풍경 속에서 중세 유럽을 만나보세요.",
    },
    BUD: {
      main: "다뉴브강의 진주, 부다페스트",
      sub: "야경이 아름다운 세체니 다리와 온천 문화를 함께 즐겨보세요.",
    },
    VIE: {
      main: "음악과 예술의 도시, 비엔나",
      sub: "웅장한 궁전과 클래식의 선율이 흐르는 우아한 여행을 즐겨보세요.",
    },
    PMI: {
      main: "지중해의 보석, 마요르카",
      sub: "맑은 해변과 고즈넉한 옛 마을에서 여유로운 휴양을 즐겨보세요.",
    },
    AGP: {
      main: "피카소의 고향, 말라가",
      sub: "코스타 델 솔의 햇살과 예술적 정취를 함께 만나보세요.",
    },
    NCE: {
      main: "코트다쥐르의 낭만, 니스",
      sub: "쪽빛 지중해와 파스텔톤 골목에서 프렌치 리비에라를 만끽해보세요.",
    },
    VCE: {
      main: "물의 도시, 베네치아",
      sub: "곤돌라를 타고 운하를 오가며 낭만적인 풍경을 만나보세요.",
    },
    LGW: {
      main: "런던으로 가는 또 다른 관문",
      sub: "개트윅 공항을 통해 런던의 클래식한 매력을 편리하게 만나보세요.",
    },
    GVA: {
      main: "알프스와 호수의 도시, 제네바",
      sub: "맑은 레만 호수와 웅장한 알프스 전망을 함께 즐겨보세요.",
    },

    AUH: {
      main: "사막 위의 미래 도시, 아부다비",
      sub: "웅장한 모스크와 화려한 스카이라인이 공존하는 이색적인 매력을 만나보세요.",
    },
    CAI: {
      main: "고대 문명의 시작, 카이로",
      sub: "피라미드와 스핑크스가 지켜온 신비로운 역사를 직접 만나보세요.",
    },
    ALA: {
      main: "톈산산맥 아래, 알마티",
      sub: "웅장한 설산 전망과 이국적인 중앙아시아 문화를 함께 느껴보세요.",
    },

    SFO: {
      main: "금문교의 도시, 샌프란시스코",
      sub: "안개 낀 금문교와 언덕 위 트램을 오가며 색다른 미국을 만나보세요.",
    },
    ATL: {
      main: "남부의 활기, 애틀랜타",
      sub: "다채로운 문화와 미국 남부 특유의 여유를 함께 느껴보세요.",
    },
    BOS: {
      main: "역사와 학문의 도시, 보스턴",
      sub: "미국 독립의 발자취와 유서 깊은 대학가의 낭만을 만나보세요.",
    },
    DFW: {
      main: "텍사스의 관문, 댈러스",
      sub: "드넓은 텍사스의 스케일과 현대적인 도심을 함께 경험해보세요.",
    },
    HNL: {
      main: "낙원의 섬, 호놀룰루",
      sub: "와이키키 해변과 다이아몬드헤드의 절경으로 완벽한 휴양을 즐겨보세요.",
      subAlt: "노스쇼어의 서핑 명소와 진주만의 역사를 함께 만나보세요.",
    },
    IAD: {
      main: "미국 역사의 중심, 워싱턴 D.C.",
      sub: "백악관과 스미소니언 박물관을 거닐며 미국의 역사를 만나보세요.",
    },
    LAS: {
      main: "밤이 빛나는 도시, 라스베이거스",
      sub: "화려한 스트립 거리와 다채로운 쇼로 잊지 못할 밤을 만들어보세요.",
      subAlt: "그랜드캐니언으로 떠나는 근교 여행과 벨라지오 분수쇼를 함께 즐겨보세요.",
    },
    ORD: {
      main: "건축의 도시, 시카고",
      sub: "웅장한 스카이라인과 미시간 호수의 풍경을 함께 즐겨보세요.",
    },
    YYZ: {
      main: "다문화가 어우러진 토론토",
      sub: "CN타워의 전망과 다채로운 문화가 공존하는 도시를 만나보세요.",
    },
    SEA: {
      main: "커피와 자연의 도시, 시애틀",
      sub: "스페이스니들의 전망과 향긋한 원조 커피 문화를 함께 즐겨보세요.",
    },
    YYC: {
      main: "로키산맥의 관문, 캘거리",
      sub: "웅장한 로키산맥과 카우보이 문화가 공존하는 도시를 만나보세요.",
    },
    YUL: {
      main: "북미 속 유럽, 몬트리올",
      sub: "고풍스러운 구시가지와 프랑스어권 특유의 감성을 함께 느껴보세요.",
    },

    BNE: {
      main: "온화한 날씨의 브리즈번",
      sub: "강변을 따라 펼쳐지는 여유로운 풍경과 온화한 기후를 즐겨보세요.",
    },
    AKL: {
      main: "돛단배의 도시, 오클랜드",
      sub: "화산과 항구가 어우러진 풍경 속에서 뉴질랜드의 자연을 만나보세요.",
    },
    SPN: {
      main: "가까운 남태평양, 사이판",
      sub: "투명한 바다와 여유로운 리조트에서 완벽한 휴양을 즐겨보세요.",
    },
    MEL: {
      main: "예술과 커피의 도시, 멜버른",
      sub: "감각적인 골목 문화와 향긋한 커피로 색다른 호주를 만나보세요.",
    },

    UBN: {
      main: "초원의 나라, 울란바토르",
      sub: "드넓은 초원과 유목민의 삶이 살아있는 이색적인 여행을 떠나보세요.",
    },
  };

  const base =
    copies[code] || {
      main: `${city || code}에서 만나는 특별한 여행`,
      sub: `${city || code}만의 풍경과 미식, 다채로운 여행 경험을 직접 만나보세요.`,
    };

  // 서브 문구가 두 개 이상 준비된 도시는 생성할 때마다 무작위로
  // 다른 스팟을 언급하는 문구가 나가도록 합니다. 아직 하나뿐인
  // 도시는 어색한 문구를 억지로 만들지 않고 그대로 씁니다.
  const subVariants =
    "subAlt" in base && base.subAlt
      ? [base.sub, base.subAlt]
      : [base.sub];

  return {
    main: base.main,
    sub: pickRandomItem(
      subVariants,
    ),
  };
}

function pickRandomItem<T>(
  items: T[],
): T {
  return items[
    Math.floor(
      Math.random() * items.length,
    )
  ];
}

function formatDateRange(
  start?: string,
  end?: string,
) {
  if (!start && !end) {
    return "";
  }

  const startLabel =
    formatKoreanDate(start ?? "");
  const endLabel =
    formatKoreanDate(end ?? "");

  if (!startLabel) {
    return endLabel;
  }

  if (!endLabel || start === end) {
    return startLabel;
  }

  return `${startLabel} ~ ${endLabel}`;
}

function formatLiveDateTime(
  value?: string,
) {
  const cleaned = cleanText(
    value ?? "",
  );

  if (!cleaned) {
    return "";
  }

  const [date, time] =
    cleaned.split(/\s+/, 2);
  const dateLabel =
    formatKoreanDate(date);

  return [dateLabel, time]
    .filter(Boolean)
    .join(" ");
}

function formatKoreanDate(
  value: string,
) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (!match) {
    return cleanText(value);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(
    Date.UTC(year, month - 1, day),
  );
  const weekday = [
    "일",
    "월",
    "화",
    "수",
    "목",
    "금",
    "토",
  ][date.getUTCDay()];

  return `${year}년 ${month}월 ${day}일(${weekday})`;
}

async function findSectionRows({
  sheets,
  spreadsheetId,
  sheetName,
  sectionTitles,
}: {
  sheets: ReturnType<
    typeof google.sheets
  >;
  spreadsheetId: string;
  sheetName: string;
  sectionTitles: string[];
}) {
  const escapedSheetName =
    escapeSheetName(
      sheetName,
    );

  const response =
    await sheets.spreadsheets.values.get(
      {
        spreadsheetId,
        range: `'${escapedSheetName}'!A1:A500`,
      },
    );

  const values =
    response.data.values ??
    [];

  const result: Record<
    string,
    number
  > = {};

  values.forEach(
    (row, index) => {
      const normalized =
        normalizeTitle(
          String(
            row[0] ?? "",
          ),
        );

      for (const title of sectionTitles) {
        if (
          normalized ===
          normalizeTitle(
            title,
          )
        ) {
          result[title] =
            index + 1;
        }
      }
    },
  );

  return result;
}

function normalizeTitle(
  value: string,
) {
  return value
    .replace(
      /^[^가-힣A-Za-z0-9]+/,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .replace(
      /^[\s○◦●•·▪▫■□◆◇▶▷✓✔※☆★→⇒➜➤☞☑☐©ⓒ+\-–—_=~:;|/\\]+/,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function createSafeSheetName(
  value: string,
) {
  return (
    value
      .replace(
        /[:\\/?*\[\]]/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90) ||
    "새 PDR"
  );
}

function createUniqueSheetName(
  baseName: string,
  existingNames: Set<string>,
) {
  if (
    !existingNames.has(
      baseName,
    )
  ) {
    return baseName;
  }

  let number = 2;

  while (
    existingNames.has(
      `${baseName} (${number})`,
    )
  ) {
    number += 1;
  }

  return `${baseName} (${number})`;
}

function escapeSheetName(
  value: string,
) {
  return value.replace(
    /'/g,
    "''",
  );
}

function columnNumberToLetter(
  columnNumber: number,
) {
  let number =
    columnNumber;
  let result = "";

  while (number > 0) {
    const remainder =
      (number - 1) % 26;

    result =
      String.fromCharCode(
        65 + remainder,
      ) + result;

    number = Math.floor(
      (number - 1) / 26,
    );
  }

  return result;
}
