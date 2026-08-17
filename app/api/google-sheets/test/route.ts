import { NextResponse } from "next/server";
import { google } from "googleapis";
import path from "path";

export async function GET() {
  try {
    const spreadsheetId =
      process.env.GOOGLE_SPREADSHEET_ID;

    const templateSheetName =
      process.env.GOOGLE_TEMPLATE_SHEET_NAME;

    const serviceAccountFile =
      process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

    if (
      !spreadsheetId ||
      !templateSheetName ||
      !serviceAccountFile
    ) {
      return NextResponse.json(
        {
          success: false,
          message: ".env.local 설정값이 누락되었습니다.",
        },
        { status: 500 },
      );
    }

    const keyFilePath = path.join(
      process.cwd(),
      serviceAccountFile,
    );

    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields:
        "spreadsheetId,properties.title,sheets.properties",
    });

    const templateSheet =
      response.data.sheets?.find(
        (sheet) =>
          sheet.properties?.title ===
          templateSheetName,
      );

    if (!templateSheet) {
      return NextResponse.json(
        {
          success: false,
          message: `${templateSheetName} 탭을 찾지 못했습니다.`,
          sheets:
            response.data.sheets?.map(
              (sheet) => sheet.properties?.title,
            ) ?? [],
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      spreadsheetTitle:
        response.data.properties?.title,
      templateSheetName:
        templateSheet.properties?.title,
      templateSheetId:
        templateSheet.properties?.sheetId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Google Sheets 연결에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}