"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent, ClipboardEvent } from "react";
import { createWorker, PSM } from "tesseract.js";
import {
  DayPicker,
  type DateRange,
} from "react-day-picker";
import { ko } from "react-day-picker/locale";
import "react-day-picker/style.css";

type PromotionType = "live" | "exhibition";
type Step = "type" | "form" | "done";

type BenefitCategory =
  | "카드"
  | "숙소"
  | "이심"
  | "와이파이"
  | "교통"
  | "라운지"
  | "상품권"
  | "투어상품"
  | "쿠폰"
  | "구독"
  | "할인"
  | "발권수수료"
  | "기타";

type BenefitInput = {
  category: BenefitCategory | "";
  name: string;
};

type GiftInput = {
  category: BenefitCategory | "";
  name: string;
  quantity: string;
};

type RouteItem = {
  region: string;
  departureCode: string;
  arrivalCode: string;
  arrivalCity: string;
  price: string;
  highlighted: boolean;
};

type FormState = {
  promotionType: string;
  sheetName: string;
  airline: string;
  promotionName: string;
  subtitle: string;
  autoSubtitle: boolean;
  saleStart: string;
  saleEnd: string;
  preNotificationStart: string;
  preNotificationEnd: string;
  liveDate: string;
  liveTime: string;
  travelStart: string;
  travelEnd: string;
  liveBenefits: BenefitInput[];
  liveGifts: GiftInput[];
  purchaseBenefits: BenefitInput[];
  airlineHighlights: string[];
  routes: RouteItem[];
};

const BENEFIT_CATEGORIES: BenefitCategory[] = [
  "카드",
  "숙소",
  "이심",
  "와이파이",
  "교통",
  "라운지",
  "상품권",
  "투어상품",
  "쿠폰",
  "구독",
  "할인",
  "발권수수료",
  "기타",
];

const AIRLINES = [
  "대한항공",
  "제주항공",
  "아시아나항공",
  "에어프레미아",
  "에어부산",
  "진에어",
  "티웨이항공",
  "이스타항공",
  "파라타항공",
  "에어서울",
  "에어로케이",
  "아메리칸항공",
  "에어프랑스",
  "에어캐나다",
  "루프트한자",
  "에어마카오",
  "에바항공",
  "에티하드항공",
  "핀에어",
  "하와이안항공",
  "ANA항공",
  "싱가포르항공",
  "말레이시아항공",
  "필리핀항공",
  "에미레이트항공",
  "캐세이퍼시픽",
  "스칸디나비아항공",
  "홍콩항공",
  "스쿠트항공",
  "중국남방항공",
  "KLM네덜란드항공",
  "에어뉴질랜드",
  "베트남항공",
  "중국동방항공",
  "하이난항공",
  "카타르항공",
];

const AIRPORTS: Record<
  string,
  { city: string; region: string }
> = {
  ICN: { city: "인천", region: "한국" },
  GMP: { city: "김포", region: "한국" },
  PUS: { city: "부산", region: "한국" },
  TAE: { city: "대구", region: "한국" },
  CJJ: { city: "청주", region: "한국" },
  CJU: { city: "제주", region: "한국" },

  NRT: { city: "도쿄", region: "일본" },
  HND: { city: "도쿄", region: "일본" },
  KIX: { city: "오사카", region: "일본" },
  UKB: { city: "고베", region: "일본" },
  FUK: { city: "후쿠오카", region: "일본" },
  CTS: { city: "삿포로", region: "일본" },
  NGO: { city: "나고야", region: "일본" },
  OKA: { city: "오키나와", region: "일본" },
  TAK: { city: "다카마쓰", region: "일본" },
  KMJ: { city: "구마모토", region: "일본" },
  HSG: { city: "사가", region: "일본" },
  SHI: { city: "시모지시마", region: "일본" },
  KKJ: { city: "기타큐슈", region: "일본" },
  ISG: { city: "이시가키", region: "일본" },
  IBR: { city: "이바라키", region: "일본" },
  OBO: { city: "오비히로", region: "일본" },
  HIJ: { city: "히로시마", region: "일본" },
  YGJ: { city: "돗토리/요나고", region: "일본" },
  TKS: { city: "도쿠시마", region: "일본" },
  FSZ: { city: "시즈오카", region: "일본" },
  MYJ: { city: "마쓰야마", region: "일본" },
  OIT: { city: "오이타", region: "일본" },
  NGS: { city: "나가사키", region: "일본" },
  OKJ: { city: "오카야마", region: "일본" },
  KMQ: { city: "고마쓰", region: "일본" },
  KOJ: { city: "가고시마", region: "일본" },

  HAN: { city: "하노이", region: "동남아" },
  SGN: { city: "호치민", region: "동남아" },
  DAD: { city: "다낭", region: "동남아" },
  CXR: { city: "나트랑", region: "동남아" },
  PQC: { city: "푸꾸옥", region: "동남아" },
  BKK: { city: "방콕", region: "동남아" },
  CNX: { city: "치앙마이", region: "동남아" },
  HKT: { city: "푸켓", region: "동남아" },
  DPS: { city: "발리", region: "동남아" },
  CGK: { city: "자카르타", region: "동남아" },
  MNL: { city: "마닐라", region: "동남아" },
  CEB: { city: "세부", region: "동남아" },
  TAG: { city: "보홀", region: "동남아" },
  SIN: { city: "싱가포르", region: "동남아" },
  KUL: { city: "쿠알라룸푸르", region: "동남아" },
  BKI: { city: "코타키나발루", region: "동남아" },
  GUM: { city: "괌", region: "대양주" },
  CRK: { city: "클락", region: "동남아" },
  DEL: { city: "델리", region: "동남아" },

  TPE: { city: "타이베이", region: "중화권" },
  RMQ: { city: "타이중", region: "중화권" },
  HKG: { city: "홍콩", region: "중화권" },
  PVG: { city: "상하이", region: "중화권" },
  PEK: { city: "베이징", region: "중화권" },
  TAO: { city: "칭다오", region: "중화권" },
  SHE: { city: "선양", region: "중화권" },
  WUH: { city: "우한", region: "중화권" },
  TNA: { city: "지난", region: "중화권" },
  KHH: { city: "가오슝", region: "중화권" },
  YNJ: { city: "옌지", region: "중화권" },
  YNT: { city: "옌타이", region: "중화권" },
  HUN: { city: "화롄", region: "중화권" },
  WEH: { city: "웨이하이", region: "중화권" },
  HRB: { city: "하얼빈", region: "중화권" },
  PKX: { city: "베이징", region: "중화권" },
  TSA: { city: "타이베이(송산)", region: "중화권" },

  CDG: { city: "파리", region: "유럽" },
  FCO: { city: "로마", region: "유럽" },
  LHR: { city: "런던", region: "유럽" },
  FRA: { city: "프랑크푸르트", region: "유럽" },
  BCN: { city: "바르셀로나", region: "유럽" },
  AMS: { city: "암스테르담", region: "유럽" },
  MXP: { city: "밀라노", region: "유럽" },
  ZRH: { city: "취리히", region: "유럽" },
  IST: { city: "이스탄불", region: "유럽" },
  MAD: { city: "마드리드", region: "유럽" },
  LIS: { city: "리스본", region: "유럽" },
  PRG: { city: "프라하", region: "유럽" },
  BUD: { city: "부다페스트", region: "유럽" },
  VIE: { city: "비엔나", region: "유럽" },
  PMI: { city: "마요르카", region: "유럽" },
  AGP: { city: "말라가", region: "유럽" },
  NCE: { city: "니스", region: "유럽" },
  VCE: { city: "베네치아", region: "유럽" },
  LGW: { city: "런던(개트윅)", region: "유럽" },
  GVA: { city: "제네바", region: "유럽" },

  AUH: { city: "아부다비", region: "중동" },
  CAI: { city: "카이로", region: "아프리카" },
  ALA: { city: "알마티", region: "중앙아시아" },

  LAX: { city: "로스앤젤레스", region: "미주" },
  JFK: { city: "뉴욕", region: "미주" },
  SFO: { city: "샌프란시스코", region: "미주" },
  YVR: { city: "밴쿠버", region: "미주" },
  ATL: { city: "애틀랜타", region: "미주" },
  BOS: { city: "보스턴", region: "미주" },
  DFW: { city: "댈러스", region: "미주" },
  HNL: { city: "호놀룰루", region: "미주" },
  IAD: { city: "워싱턴 D.C.", region: "미주" },
  LAS: { city: "라스베이거스", region: "미주" },
  ORD: { city: "시카고", region: "미주" },
  YYZ: { city: "토론토", region: "미주" },
  SEA: { city: "시애틀", region: "미주" },
  YYC: { city: "캘거리", region: "미주" },
  YUL: { city: "몬트리올", region: "미주" },

  SYD: { city: "시드니", region: "대양주" },
  BNE: { city: "브리즈번", region: "대양주" },
  AKL: { city: "오클랜드", region: "대양주" },
  SPN: { city: "사이판", region: "대양주" },
  MEL: { city: "멜버른", region: "대양주" },

  CAN: { city: "광저우", region: "중화권" },
  CGO: { city: "정저우", region: "중화권" },
  CSX: { city: "창사", region: "중화권" },
  DYG: { city: "장가계", region: "중화권" },
  MFM: { city: "마카오", region: "중화권" },
  SZX: { city: "선전", region: "중화권" },

  UBN: { city: "울란바토르", region: "몽골" },
};

const DEPARTURE_CODES = new Set([
  "ICN",
  "GMP",
  "PUS",
  "TAE",
  "CJJ",
  "CJU",
]);

const CITY_TO_CODE: Record<string, string> = {
  인천: "ICN",
  김포: "GMP",
  부산: "PUS",
  대구: "TAE",
  청주: "CJJ",
  제주: "CJU",
  도쿄: "NRT",
  나리타: "NRT",
  하네다: "HND",
  오사카: "KIX",
  고베: "UKB",
  후쿠오카: "FUK",
  삿포로: "CTS",
  나고야: "NGO",
  오키나와: "OKA",
  다카마쓰: "TAK",
  시모지시마: "SHI",
  기타큐슈: "KKJ",
  이시가키: "ISG",
  하노이: "HAN",
  호치민: "SGN",
  다낭: "DAD",
  나트랑: "CXR",
  푸꾸옥: "PQC",
  방콕: "BKK",
  치앙마이: "CNX",
  푸켓: "HKT",
  발리: "DPS",
  자카르타: "CGK",
  마닐라: "MNL",
  세부: "CEB",
  보홀: "TAG",
  싱가포르: "SIN",
  쿠알라룸푸르: "KUL",
  코타키나발루: "BKI",
  괌: "GUM",
  클락: "CRK",
  타이베이: "TPE",
  타이중: "RMQ",
  홍콩: "HKG",
  상하이: "PVG",
  베이징: "PEK",
  칭다오: "TAO",
  파리: "CDG",
  로마: "FCO",
  런던: "LHR",
  프랑크푸르트: "FRA",
  바르셀로나: "BCN",
  로스앤젤레스: "LAX",
  뉴욕: "JFK",
  샌프란시스코: "SFO",
  밴쿠버: "YVR",
  시드니: "SYD",
  브리즈번: "BNE",
};

// 같은 형식의 프로모션이 반복되는 경우가 많아서, 마지막으로 생성 완료한
// 내용을 브라우저에 저장해두고 다음번에 그대로 불러올 수 있게 합니다.
// 라이브/기획전은 서로 다른 형식이라 각각 마지막 1건씩 따로 보관합니다.
const LAST_FORMS_STORAGE_KEY =
  "astryx-promo-last-forms-v2";

type SavedForm = {
  promotionType: PromotionType;
  form: FormState;
  savedAt: string;
};

type SavedForms = Partial<
  Record<PromotionType, SavedForm>
>;

function loadSavedForms(): SavedForms {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(
      LAST_FORMS_STORAGE_KEY,
    );

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(
      raw,
    ) as SavedForms;

    return typeof parsed === "object" &&
      parsed !== null
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function saveFormForLater(
  promotionType: PromotionType,
  form: FormState,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = loadSavedForms();

    const next: SavedForms = {
      ...current,
      [promotionType]: {
        promotionType,
        form,
        savedAt: new Date().toISOString(),
      },
    };

    window.localStorage.setItem(
      LAST_FORMS_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // 저장 실패는 기능에 영향 없으니 조용히 무시합니다.
  }
}

// 부제 자동 생성용 문구 후보들. 매번 다른 문구가 나오도록 여러 개를 두고
// 무작위로 고르며, 강조/전체 노선의 대표 권역이 있으면 그 권역에 맞는
// 문구도 후보에 섞습니다. (예시 문구를 그대로 베끼지 않도록 계속 늘려갈 것)
const GENERIC_SUBTITLE_TEMPLATES = [
  "꿈꿔온 여행을 더 가까이",
  "여행 고민은 덜고, 설렘은 더하고",
  "떠나고 싶은 마음, 지금이 딱이에요",
  "지금이 아니면 놓치는 특가",
  "가고 싶던 그곳, 이번엔 부담 없이",
  "여행의 설렘을 더 자주, 더 가볍게",
  "망설이던 그 여행, 지금 떠나보세요",
];

const REGION_SUBTITLE_TEMPLATES: Record<
  string,
  string[]
> = {
  동남아: [
    "올여름 동남아 휴가를 더 합리적으로",
    "가까운 동남아, 부담 없는 가격으로",
    "동남아 여행, 지금이 가장 좋은 타이밍",
  ],
  일본: [
    "가장 가까운 일본, 가장 좋은 가격으로",
    "훌쩍 떠나는 일본 여행, 지금이 기회",
    "익숙한 듯 새로운 일본, 부담 없이",
  ],
  중화권: [
    "가까운 중화권 노선, 놓치기 아까운 가격",
    "짧게 떠나는 중화권 여행, 지금이 적기",
  ],
  유럽: [
    "꿈꾸던 유럽, 조금 더 가까이",
    "먼 유럽도 이번엔 합리적인 가격으로",
  ],
  미주: [
    "머나먼 미주도 이번엔 합리적으로",
    "꿈에 그리던 미주, 이번 기회에",
  ],
  대양주: [
    "이국적인 대양주, 부담 없이 떠나요",
  ],
};

function pickDominantRegion(
  routes: RouteItem[],
): string {
  const counts: Record<string, number> = {};

  for (const route of routes) {
    if (!route.region) {
      continue;
    }

    counts[route.region] =
      (counts[route.region] ?? 0) + 1;
  }

  let bestRegion = "";
  let bestCount = 0;

  for (const [region, count] of Object.entries(
    counts,
  )) {
    if (count > bestCount) {
      bestRegion = region;
      bestCount = count;
    }
  }

  return bestRegion;
}

function generateAutoSubtitle(
  routes: RouteItem[],
  previous: string,
): string {
  const highlighted = routes.filter(
    (route) => route.highlighted,
  );

  const region = pickDominantRegion(
    highlighted.length > 0
      ? highlighted
      : routes,
  );

  const pool = [
    ...GENERIC_SUBTITLE_TEMPLATES,
    ...(region &&
    REGION_SUBTITLE_TEMPLATES[region]
      ? REGION_SUBTITLE_TEMPLATES[region]
      : []),
  ];

  const candidates = pool.filter(
    (phrase) => phrase !== previous,
  );

  const source =
    candidates.length > 0
      ? candidates
      : pool;

  return source[
    Math.floor(
      Math.random() * source.length,
    )
  ];
}

const EMPTY_FORM: FormState = {
  promotionType: "",
  sheetName: "",
  airline: "",
  promotionName: "",
  subtitle: "",
  autoSubtitle: true,
  saleStart: "",
  saleEnd: "",
  preNotificationStart: "",
  preNotificationEnd: "",
  liveDate: "",
  liveTime: "",
  travelStart: "",
  travelEnd: "",
  liveBenefits: [],
  liveGifts: [],
  purchaseBenefits: [],
  airlineHighlights: [],
  routes: [],
};

export default function Home() {
  const [step, setStep] = useState<Step>("type");
  const [promotionType, setPromotionType] =
    useState<PromotionType | null>(null);
  const [form, setForm] =
    useState<FormState>(EMPTY_FORM);
  const [routeImageName, setRouteImageName] =
    useState("");
  const [routeStatus, setRouteStatus] =
    useState("");
  const [isReadingRoutes, setIsReadingRoutes] =
    useState(false);
  const [isCreating, setIsCreating] =
    useState(false);
  const [createdUrls, setCreatedUrls] =
    useState({
      promo: "",
      htk: "",
    });
  const [generationStatus, setGenerationStatus] =
    useState({
      message: "",
      promoError: "",
      htkError: "",
    });
  const [savedForms, setSavedForms] =
    useState<SavedForms>({});

  useEffect(() => {
    setSavedForms(loadSavedForms());
  }, []);

  const loadPreviousContent = (
    type: PromotionType,
  ) => {
    const saved = loadSavedForms()[type];

    if (!saved) {
      return;
    }

    setPromotionType(saved.promotionType);
    setForm(saved.form);
    setStep("form");
  };
  const [error, setError] = useState("");

  const highlightedCount = useMemo(
    () =>
      form.routes.filter(
        (route) => route.highlighted,
      ).length,
    [form.routes],
  );

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  // "자동" 체크가 켜져 있고 부제를 비워두면, 강조/전체 노선의 대표
  // 권역에 맞춰 매번 다른 부제 문구를 채워 넣습니다.
  useEffect(() => {
    if (
      form.autoSubtitle &&
      !form.subtitle.trim()
    ) {
      setForm((previous) => ({
        ...previous,
        subtitle: generateAutoSubtitle(
          previous.routes,
          "",
        ),
      }));
    }
  }, [
    form.autoSubtitle,
    form.subtitle,
    form.routes,
  ]);

  const regenerateSubtitle = () => {
    setForm((previous) => ({
      ...previous,
      autoSubtitle: true,
      subtitle: generateAutoSubtitle(
        previous.routes,
        previous.subtitle,
      ),
    }));
  };

  const choosePromotionType = (
    type: PromotionType,
  ) => {
    setPromotionType(type);
    setForm({
      ...EMPTY_FORM,
      promotionType:
        type === "live" ? "라이브" : "기획전",
    });
    setStep("form");
  };

  const processRouteImage = async (
    file: File,
  ) => {
    setError("");
    setRouteImageName(file.name);
    setRouteStatus(
      "출발지·도착지 열 전체를 분석하고 있습니다.",
    );
    setIsReadingRoutes(true);

    setForm((previous) => ({
      ...previous,
      routes: [],
    }));

    let worker: Awaited<
      ReturnType<typeof createWorker>
    > | null = null;

    try {
      const columns =
        await createRouteColumnVariants(file);

      worker = await createWorker(
        "eng",
        1,
        {
          logger: (message: {
            status: string;
            progress: number;
          }) => {
            if (
              message.status ===
              "recognizing text"
            ) {
              setRouteStatus(
                "노선 읽는 중...",
              );
            }
          },
        },
      );

      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789()",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const departureTexts: string[] = [];
      const arrivalTexts: string[] = [];

      for (const image of columns.departure) {
        const result =
          await worker.recognize(image);
        departureTexts.push(
          result.data.text,
        );
      }

      for (const image of columns.arrival) {
        const result =
          await worker.recognize(image);
        arrivalTexts.push(
          result.data.text,
        );
      }

      const departureCodes =
        chooseBestCodeSequence(
          departureTexts,
          true,
        );
      const arrivalCodes =
        chooseBestCodeSequence(
          arrivalTexts,
          false,
        );

      const detectedRoutes: RouteItem[] = [];

      if (arrivalCodes.length > 0) {
        const normalizedDepartures =
          normalizeDepartureSequence(
            departureCodes,
            arrivalCodes.length,
          );

        for (
          let index = 0;
          index < arrivalCodes.length;
          index += 1
        ) {
          const departureCode =
            normalizedDepartures[index];
          const arrivalCode =
            arrivalCodes[index];
          const destination =
            AIRPORTS[arrivalCode];

          if (
            !departureCode ||
            !destination
          ) {
            continue;
          }

          detectedRoutes.push({
            region: destination.region,
            departureCode,
            arrivalCode,
            arrivalCity: destination.city,
            price: "",
            highlighted: false,
          });
        }
      }

      let uniqueRoutes = mergeRoutes(
        [],
        detectedRoutes,
      );

      // 출발/도착 2단 컬럼 크롭 방식은 표에 세로 구분선이
      // 뚜렷하지 않거나(권역·항공사·코드 등 컬럼이 더 있는 경우)
      // 고정 비율로 잘못 잘라서 일부 행을 놓칠 수 있습니다.
      // 그래서 컬럼 크롭 결과가 있어도 항상 이미지 전체를 단어
      // 좌표 기반으로 다시 스캔해 눈에 보이는 공항코드로 노선을
      // 추출한 뒤, 두 결과를 합쳐서(중복 제거) 놓친 노선을 보강합니다.
      // 출발지를 찾지 못하면 인천(ICN) 출발로 채웁니다.
      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789()/*",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const wholeImageVariants =
        await createWholeImageVariants(
          file,
        );

      let bestRoutes: RouteItem[] = [];

      for (const variant of wholeImageVariants) {
        const result =
          await worker.recognize(
            variant,
            {},
            { blocks: true },
          );

        const excludedCodes =
          extractFootnoteExcludedCodes(
            result.data.text,
          );

        const variantRoutes =
          extractRoutesFromOcrWords(
            collectOcrWords(
              result.data,
            ),
            excludedCodes,
          );

        if (
          variantRoutes.length >
          bestRoutes.length
        ) {
          bestRoutes = variantRoutes;
        }
      }

      uniqueRoutes = mergeRoutes(
        uniqueRoutes,
        bestRoutes,
      );

      if (uniqueRoutes.length === 0) {
        throw new Error(
          "이미지에서 노선을 찾지 못했습니다. 공항 코드가 잘 보이도록 다시 캡처해 주세요.",
        );
      }

      setForm((previous) => ({
        ...previous,
        routes: uniqueRoutes,
      }));
      setRouteStatus(
        `${uniqueRoutes.length}개 노선 추출 완료`,
      );
      setError("");
    } catch (caughtError) {
      setForm((previous) => ({
        ...previous,
        routes: [],
      }));
      setRouteStatus("");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "노선 이미지 분석에 실패했습니다.",
      );
    } finally {
      if (worker) {
        await worker.terminate();
      }

      setIsReadingRoutes(false);
    }
  };

  const resetRoutesOnly = () => {
    setForm((previous) => ({
      ...previous,
      routes: [],
    }));
    setRouteImageName("");
    setRouteStatus("");
    setError("");
  };

  const handleRouteFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (file) {
      await processRouteImage(file);
    }
  };

  const handleClipboardButton =
    async () => {
      setError("");

      try {
        if (
          !navigator.clipboard?.read
        ) {
          throw new Error(
            "현재 브라우저에서 클립보드 이미지 읽기를 지원하지 않습니다.",
          );
        }

        const clipboardItems =
          await navigator.clipboard.read();

        for (const item of clipboardItems) {
          const imageType =
            item.types.find((type) =>
              type.startsWith("image/"),
            );

          if (!imageType) {
            continue;
          }

          const blob =
            await item.getType(imageType);

          const extension =
            imageType.split("/")[1] ??
            "png";

          const file = new File(
            [blob],
            `clipboard-route.${extension}`,
            {
              type: imageType,
            },
          );

          await processRouteImage(file);
          return;
        }

        throw new Error(
          "클립보드에 이미지가 없습니다. 이미지를 복사한 뒤 다시 눌러 주세요.",
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "클립보드 이미지를 가져오지 못했습니다.",
        );
      }
    };

  const handlePaste = async (
    event: ClipboardEvent<HTMLDivElement>,
  ) => {
    const imageItem = Array.from(
      event.clipboardData.items,
    ).find((item) =>
      item.type.startsWith("image/"),
    );

    if (!imageItem) {
      return;
    }

    event.preventDefault();

    const file =
      imageItem.getAsFile();

    if (file) {
      await processRouteImage(file);
    }
  };

  const createPdr = async () => {
    setError("");

    if (!form.airline) {
      setError(
        "항공사를 선택해 주세요.",
      );
      return;
    }

    if (!form.promotionName.trim()) {
      setError(
        "프로모션 제목을 입력해 주세요.",
      );
      return;
    }

    setIsCreating(true);

    try {
      const liveStart =
        form.liveDate && form.liveTime
          ? `${form.liveDate} ${form.liveTime}`
          : form.liveDate;

      const response = await fetch(
        "/api/google-sheets/create",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            ...form,
            sheetName:
              form.sheetName.trim(),
            liveStart,
          }),
        },
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "PDR 생성에 실패했습니다.",
        );
      }

      if (promotionType) {
        saveFormForLater(promotionType, form);
        setSavedForms(loadSavedForms());
      }

      setCreatedUrls({
        promo:
          result.promo?.sheetUrl ||
          result.sheetUrl ||
          "",
        htk:
          result.htk?.sheetUrl ||
          "",
      });
      setGenerationStatus({
        message:
          result.message ||
          "PDR 생성 작업이 완료되었습니다.",
        promoError:
          result.promoError || "",
        htkError:
          result.htkError || "",
      });
      setStep("done");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "PDR 생성에 실패했습니다.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (step === "done") {
    const isLive = promotionType === "live";
    const isFullSuccess =
      createdUrls.promo &&
      (!isLive || createdUrls.htk);

    return (
      <main className="min-h-screen bg-slate-50 px-6 py-14">
        <div className="mx-auto max-w-2xl rounded-3xl border bg-white p-10 text-center">
          <div className="text-5xl">
            {isFullSuccess ? "✅" : "⚠️"}
          </div>
          <h1 className="mt-5 text-3xl font-bold">
            {isFullSuccess
              ? isLive
                ? "PDR·HTK 상품안 생성 완료"
                : "PDR 생성 완료"
              : "PDR 일부 생성 완료"}
          </h1>
          <p className="mt-3 whitespace-pre-line text-slate-600">
            {generationStatus.message}
          </p>

          {(generationStatus.promoError ||
            (isLive && generationStatus.htkError)) && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700">
              {generationStatus.promoError && (
                <p>
                  <strong>프모페 오류:</strong>{" "}
                  {generationStatus.promoError}
                </p>
              )}
              {isLive && generationStatus.htkError && (
                <p className={generationStatus.promoError ? "mt-2" : ""}>
                  <strong>HTK 상품안 오류:</strong>{" "}
                  {generationStatus.htkError}
                </p>
              )}
            </div>
          )}

          <div
            className={`mt-8 grid gap-3 ${
              isLive ? "sm:grid-cols-2" : ""
            }`}
          >
            {createdUrls.promo ? (
              <a
                href={createdUrls.promo}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white"
              >
                PDR 열기
              </a>
            ) : (
              <div className="rounded-xl bg-slate-200 px-6 py-3 font-bold text-slate-500">
                프모페 생성 실패
              </div>
            )}

            {isLive &&
              (createdUrls.htk ? (
                <a
                  href={createdUrls.htk}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border-2 border-blue-600 bg-white px-6 py-3 font-bold text-blue-600"
                >
                  HTK 상품안 보러가기
                </a>
              ) : (
                <div className="rounded-xl border-2 border-slate-200 bg-slate-100 px-6 py-3 font-bold text-slate-500">
                  HTK 상품안 생성 실패
                </div>
              ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setStep("type");
              setPromotionType(null);
              setForm(EMPTY_FORM);
              setCreatedUrls({ promo: "", htk: "" });
              setGenerationStatus({
                message: "",
                promoError: "",
                htkError: "",
              });
              setError("");
              setRouteImageName("");
              setRouteStatus("");
            }}
            className="mt-4 block w-full rounded-xl border px-6 py-3 font-bold"
          >
            새 PDR 만들기
          </button>
        </div>
      </main>
    );
  }

  if (step === "form") {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <button
            type="button"
            onClick={() =>
              setStep("type")
            }
            className="mb-7 text-sm font-semibold text-slate-500"
          >
            ← 프로모션 유형 다시 선택
          </button>

          <p className="text-sm font-bold text-blue-600">
            PDR 정보 입력
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            항공 프로모션 PDR 생성
          </h1>

          <section className="mt-8 rounded-2xl border bg-white p-6">
            <h2 className="text-xl font-bold">
              기본 정보
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <TextInput
                label="생성될 탭 이름"
                value={form.sheetName}
                placeholder={`비워두면 예: 7.14 아시아나항공 ${
                  promotionType === "live"
                    ? "라이브"
                    : "기획전"
                }`}
                onChange={(value) =>
                  updateForm(
                    "sheetName",
                    value,
                  )
                }
              />

              <SelectInput
                label="항공사"
                value={form.airline}
                options={AIRLINES}
                placeholder="항공사를 선택해 주세요"
                onChange={(value) =>
                  updateForm(
                    "airline",
                    value,
                  )
                }
              />

              <TextInput
                label="프로모션 제목"
                value={
                  form.promotionName
                }
                placeholder="예: 인기 노선 단독 특가 (항공사명은 자동으로 앞에 붙어요)"
                onChange={(value) =>
                  updateForm(
                    "promotionName",
                    value,
                  )
                }
              />

              <label>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    부제
                  </span>

                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={
                          form.autoSubtitle
                        }
                        onChange={(event) =>
                          updateForm(
                            "autoSubtitle",
                            event.target
                              .checked,
                          )
                        }
                      />
                      자동
                    </label>

                    {form.autoSubtitle && (
                      <button
                        type="button"
                        onClick={
                          regenerateSubtitle
                        }
                        className="text-blue-600"
                      >
                        ↻ 다른 문구
                      </button>
                    )}
                  </span>
                </div>

                <input
                  value={form.subtitle}
                  placeholder="예: 전 노선을 더 합리적인 가격으로"
                  onChange={(event) =>
                    updateForm(
                      "subtitle",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </label>

              <DateRangePicker
                label="프로모션 기간"
                start={form.saleStart}
                end={form.saleEnd}
                onChange={(
                  start,
                  end,
                ) => {
                  updateForm(
                    "saleStart",
                    start,
                  );
                  updateForm(
                    "saleEnd",
                    end,
                  );
                }}
              />

              <DateRangePicker
                label="출발 기간"
                start={
                  form.travelStart
                }
                end={form.travelEnd}
                onChange={(
                  start,
                  end,
                ) => {
                  updateForm(
                    "travelStart",
                    start,
                  );
                  updateForm(
                    "travelEnd",
                    end,
                  );
                }}
              />

              {promotionType ===
                "live" && (
                <>
                  <DateRangePicker
                    label="사전알림 기간"
                    start={
                      form.preNotificationStart
                    }
                    end={
                      form.preNotificationEnd
                    }
                    onChange={(
                      start,
                      end,
                    ) => {
                      updateForm(
                        "preNotificationStart",
                        start,
                      );
                      updateForm(
                        "preNotificationEnd",
                        end,
                      );
                    }}
                  />

                  <LiveDateTimeInput
                    date={
                      form.liveDate
                    }
                    time={
                      form.liveTime
                    }
                    onDateChange={(
                      value,
                    ) =>
                      updateForm(
                        "liveDate",
                        value,
                      )
                    }
                    onTimeChange={(
                      value,
                    ) =>
                      updateForm(
                        "liveTime",
                        value,
                      )
                    }
                  />
                </>
              )}
            </div>
          </section>

          {promotionType ===
            "live" && (
            <>
              <BenefitEditor
                title="라이브 혜택"
                items={
                  form.liveBenefits
                }
                onChange={(items) =>
                  updateForm(
                    "liveBenefits",
                    items,
                  )
                }
              />

              <GiftEditor
                items={
                  form.liveGifts
                }
                onChange={(items) =>
                  updateForm(
                    "liveGifts",
                    items,
                  )
                }
              />

              <BenefitEditor
                title="구매 혜택"
                items={
                  form.purchaseBenefits
                }
                onChange={(items) =>
                  updateForm(
                    "purchaseBenefits",
                    items,
                  )
                }
              />
            </>
          )}

          <HighlightEditor
            items={
              form.airlineHighlights
            }
            onChange={(items) =>
              updateForm(
                "airlineHighlights",
                items,
              )
            }
          />

          <section className="mt-6 rounded-2xl border bg-white p-6">
            <h2 className="text-xl font-bold">
              전체 노선 이미지 분석
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              다운로드한 이미지를 선택하거나 클립보드 이미지를 바로 붙여넣어 주세요.
            </p>

            <div
              tabIndex={0}
              onPaste={handlePaste}
              className="mt-5 rounded-2xl border-2 border-dashed border-slate-300 p-5 outline-none focus:border-blue-500"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <label
                  htmlFor="route-image"
                  className="flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-5 py-4 font-bold text-white"
                >
                  📁 다운로드한 이미지 선택
                </label>

                <input
                  id="route-image"
                  type="file"
                  accept="image/*"
                  onChange={
                    handleRouteFile
                  }
                  className="sr-only"
                />

                <button
                  type="button"
                  onClick={
                    handleClipboardButton
                  }
                  disabled={
                    isReadingRoutes
                  }
                  className="rounded-xl border-2 border-blue-600 bg-white px-5 py-4 font-bold text-blue-600 disabled:border-slate-300 disabled:text-slate-400"
                >
                  📋 클립보드 이미지 붙여넣기
                </button>

                <button
                  type="button"
                  onClick={resetRoutesOnly}
                  disabled={
                    isReadingRoutes ||
                    form.routes.length === 0
                  }
                  className="rounded-xl border px-5 py-4 font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  ↺ 노선 결과 초기화
                </button>
              </div>

              <p className="mt-4 text-center text-sm text-slate-500">
                이 박스를 클릭한 뒤 Ctrl + V로 붙여넣어도 됩니다.
              </p>

              {routeImageName && (
                <p className="mt-3 text-sm text-slate-600">
                  선택된 이미지:{" "}
                  {routeImageName}
                </p>
              )}

              {routeStatus && (
                <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
                  {routeStatus}
                </div>
              )}
            </div>
          </section>

          <RouteEditor
            routes={form.routes}
            onChange={(routes) =>
              updateForm(
                "routes",
                routes,
              )
            }
          />

          <p className="mt-4 text-sm text-slate-500">
            체크한 강조 노선{" "}
            {highlightedCount}개의 여행지 특색을 반영해 메인·서브 문구가 자동 생성됩니다.
          </p>

          {error && (
            <ErrorBox
              message={error}
            />
          )}

          <button
            type="button"
            onClick={createPdr}
            disabled={
              isCreating ||
              isReadingRoutes
            }
            className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 font-bold text-white disabled:bg-slate-300"
          >
            {promotionType === "live"
              ? isCreating
                ? "프모페용·HTK용 PDR 생성 중..."
                : "PDR 두 개 동시에 생성"
              : isCreating
                ? "PDR 생성 중..."
                : "PDR 생성"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-14">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-bold text-blue-600">
          항공 프로모션 PDR 생성
        </p>
        <h1 className="mt-3 text-4xl font-bold">
          어떤 프로모션을 준비하고 있나요?
        </h1>

        <section className="mt-12 grid gap-5 md:grid-cols-2">
          <TypeButton
            icon="📺"
            title="라이브 프로모션"
            onClick={() =>
              choosePromotionType(
                "live",
              )
            }
          />

          <TypeButton
            icon="✈️"
            title="일반 기획전"
            onClick={() =>
              choosePromotionType(
                "exhibition",
              )
            }
          />
        </section>

        {(
          [
            ["live", "라이브 프로모션"],
            ["exhibition", "일반 기획전"],
          ] as const
        ).map(([type, label]) => {
          const saved = savedForms[type];

          if (!saved) {
            return null;
          }

          return (
            <div
              key={type}
              className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"
            >
              <p className="text-sm text-slate-600">
                마지막으로 생성한 {label} 내용이
                저장되어 있습니다.
                {saved.form.promotionName
                  ? ` (${saved.form.promotionName})`
                  : ""}
              </p>

              <button
                type="button"
                onClick={() =>
                  loadPreviousContent(type)
                }
                className="rounded-xl border-2 border-blue-600 px-5 py-2 font-bold text-blue-600"
              >
                ↺ {label} 이전 내용 불러오기
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function BenefitEditor({
  title,
  items,
  onChange,
}: {
  title: string;
  items: BenefitInput[];
  onChange: (
    items: BenefitInput[],
  ) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            메인·서브 문구는 PDR 생성 시 자동으로 만들어집니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onChange([
              ...items,
              {
                category: "",
                name: "",
              },
            ])
          }
          className="font-bold text-blue-600"
        >
          + 항목 추가
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {items.map(
          (item, index) => (
            <div
              key={`${title}-${index}`}
              className="grid gap-3 md:grid-cols-[220px_1fr_auto]"
            >
              <select
                value={
                  item.category
                }
                onChange={(
                  event,
                ) => {
                  const next = [
                    ...items,
                  ];
                  next[index] = {
                    ...next[index],
                    category:
                      event.target
                        .value as BenefitCategory,
                  };
                  onChange(next);
                }}
                className="rounded-xl border px-4 py-3"
              >
                <option value="">
                  구분 선택
                </option>
                {BENEFIT_CATEGORIES.map(
                  (category) => (
                    <option
                      key={
                        category
                      }
                      value={
                        category
                      }
                    >
                      {category}
                    </option>
                  ),
                )}
              </select>

              <input
                value={item.name}
                placeholder="혜택 내용을 입력해 주세요"
                onChange={(
                  event,
                ) => {
                  const next = [
                    ...items,
                  ];
                  next[index] = {
                    ...next[index],
                    name:
                      event.target
                        .value,
                  };
                  onChange(next);
                }}
                className="rounded-xl border px-4 py-3"
              />

              <button
                type="button"
                onClick={() =>
                  onChange(
                    items.filter(
                      (
                        _,
                        itemIndex,
                      ) =>
                        itemIndex !==
                        index,
                    ),
                  )
                }
                className="rounded-xl border px-4 text-red-500"
              >
                삭제
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function GiftEditor({
  items,
  onChange,
}: {
  items: GiftInput[];
  onChange: (
    items: GiftInput[],
  ) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            라이브 경품
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            구분·경품명·수량만 입력해 주세요.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onChange([
              ...items,
              {
                category: "",
                name: "",
                quantity: "",
              },
            ])
          }
          className="font-bold text-blue-600"
        >
          + 경품 추가
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {items.map(
          (item, index) => (
            <div
              key={`gift-${index}`}
              className="grid gap-3 md:grid-cols-[220px_1fr_180px_auto]"
            >
              <select
                value={
                  item.category
                }
                onChange={(
                  event,
                ) => {
                  const next = [
                    ...items,
                  ];
                  next[index] = {
                    ...next[index],
                    category:
                      event.target
                        .value as BenefitCategory,
                  };
                  onChange(next);
                }}
                className="rounded-xl border px-4 py-3"
              >
                <option value="">
                  구분 선택
                </option>
                {BENEFIT_CATEGORIES.map(
                  (category) => (
                    <option
                      key={
                        category
                      }
                      value={
                        category
                      }
                    >
                      {category}
                    </option>
                  ),
                )}
              </select>

              <input
                value={item.name}
                placeholder="경품명"
                onChange={(
                  event,
                ) => {
                  const next = [
                    ...items,
                  ];
                  next[index] = {
                    ...next[index],
                    name:
                      event.target
                        .value,
                  };
                  onChange(next);
                }}
                className="rounded-xl border px-4 py-3"
              />

              <input
                value={
                  item.quantity
                }
                placeholder="예: 2명, 3매"
                onChange={(
                  event,
                ) => {
                  const next = [
                    ...items,
                  ];
                  next[index] = {
                    ...next[index],
                    quantity:
                      event.target
                        .value,
                  };
                  onChange(next);
                }}
                className="rounded-xl border px-4 py-3"
              />

              <button
                type="button"
                onClick={() =>
                  onChange(
                    items.filter(
                      (
                        _,
                        itemIndex,
                      ) =>
                        itemIndex !==
                        index,
                    ),
                  )
                }
                className="rounded-xl border px-4 text-red-500"
              >
                삭제
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function HighlightEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (
    items: string[],
  ) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            항공사 강조
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            구분 없이 강조할 내용을 입력해 주세요.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onChange([
              ...items,
              "",
            ])
          }
          className="font-bold text-blue-600"
        >
          + 항목 추가
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {items.map(
          (item, index) => (
            <div
              key={`highlight-${index}`}
              className="flex gap-3"
            >
              <input
                value={item}
                placeholder="예: 위탁 수하물 15KG 포함"
                onChange={(
                  event,
                ) => {
                  const next = [
                    ...items,
                  ];
                  next[index] =
                    event.target.value;
                  onChange(next);
                }}
                className="flex-1 rounded-xl border px-4 py-3"
              />

              <button
                type="button"
                onClick={() =>
                  onChange(
                    items.filter(
                      (
                        _,
                        itemIndex,
                      ) =>
                        itemIndex !==
                        index,
                    ),
                  )
                }
                className="rounded-xl border px-4 text-red-500"
              >
                삭제
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function RouteEditor({
  routes,
  onChange,
}: {
  routes: RouteItem[];
  onChange: (
    routes: RouteItem[],
  ) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          전체 노선
        </h2>

        <button
          type="button"
          onClick={() =>
            onChange([
              ...routes,
              {
                region: "",
                departureCode: "",
                arrivalCode: "",
                arrivalCity: "",
                price: "",
                highlighted: false,
              },
            ])
          }
          className="font-bold text-blue-600"
        >
          + 노선 직접 추가
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3">
                강조
              </th>
              <th className="p-3">
                권역
              </th>
              <th className="p-3">
                출발 공항
              </th>
              <th className="p-3">
                도착 공항
              </th>
              <th className="p-3">
                여행지
              </th>
              <th className="p-3">
                삭제
              </th>
            </tr>
          </thead>

          <tbody>
            {routes.map(
              (route, index) => (
                <tr
                  key={`${route.departureCode}-${route.arrivalCode}-${index}`}
                >
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={
                        route.highlighted
                      }
                      onChange={(
                        event,
                      ) => {
                        const next = [
                          ...routes,
                        ];
                        next[index] = {
                          ...next[index],
                          highlighted:
                            event
                              .target
                              .checked,
                        };
                        onChange(next);
                      }}
                    />
                  </td>

                  {(
                    [
                      [
                        "region",
                        "권역",
                      ],
                      [
                        "departureCode",
                        "출발 공항",
                      ],
                      [
                        "arrivalCode",
                        "도착 공항",
                      ],
                      [
                        "arrivalCity",
                        "여행지",
                      ],
                    ] as const
                  ).map(
                    ([
                      key,
                      placeholder,
                    ]) => (
                      <td
                        key={key}
                        className="p-2"
                      >
                        <input
                          value={
                            route[key]
                          }
                          placeholder={
                            placeholder
                          }
                          onChange={(
                            event,
                          ) => {
                            const next = [
                              ...routes,
                            ];
                            next[index] = {
                              ...next[
                                index
                              ],
                              [key]:
                                key ===
                                  "departureCode" ||
                                key ===
                                  "arrivalCode"
                                  ? event.target.value.toUpperCase()
                                  : event.target.value,
                            };
                            onChange(
                              next,
                            );
                          }}
                          className="w-full rounded-lg border px-3 py-2"
                        />
                      </td>
                    ),
                  )}

                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          routes.filter(
                            (
                              _,
                              routeIndex,
                            ) =>
                              routeIndex !==
                              index,
                          ),
                        )
                      }
                      className="text-red-500"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DateRangePicker({
  label,
  start,
  end,
  onChange,
}: {
  label: string;
  start: string;
  end: string;
  onChange: (
    start: string,
    end: string,
  ) => void;
}) {
  const [isOpen, setIsOpen] =
    useState(false);
  const [draft, setDraft] =
    useState<DateRange | undefined>(
      stringsToRange(
        start,
        end,
      ),
    );

  const displayValue =
    start && end
      ? `${formatDateLabel(
          start,
        )} ~ ${formatDateLabel(
          end,
        )}`
      : "기간을 선택해 주세요";

  return (
    <div className="relative">
      <span className="mb-2 block text-sm font-semibold">
        {label}
      </span>

      <button
        type="button"
        onClick={() => {
          setDraft(
            stringsToRange(
              start,
              end,
            ),
          );
          setIsOpen(
            (previous) =>
              !previous,
          );
        }}
        className="w-full rounded-xl border px-4 py-3 text-left"
      >
        {displayValue}
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-2 rounded-2xl border bg-white p-4 shadow-xl">
          <DayPicker
            mode="range"
            numberOfMonths={1}
            selected={draft}
            onSelect={setDraft}
            locale={ko}
          />

          <div className="mt-3 flex justify-end gap-2 border-t pt-3">
            <button
              type="button"
              onClick={() => {
                setDraft(
                  undefined,
                );
                onChange("", "");
                setIsOpen(false);
              }}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              초기화
            </button>

            <button
              type="button"
              disabled={
                !draft?.from ||
                !draft?.to
              }
              onClick={() => {
                if (
                  !draft?.from ||
                  !draft?.to
                ) {
                  return;
                }

                onChange(
                  dateToString(
                    draft.from,
                  ),
                  dateToString(
                    draft.to,
                  ),
                );
                setIsOpen(false);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const LIVE_HOURS = Array.from(
  { length: 24 },
  (_, hour) => String(hour).padStart(2, "0"),
);

const LIVE_MINUTES = Array.from(
  { length: 12 },
  (_, index) =>
    String(index * 5).padStart(2, "0"),
);

function LiveDateTimeInput({
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  time: string;
  onDateChange: (
    value: string,
  ) => void;
  onTimeChange: (
    value: string,
  ) => void;
}) {
  const [hour, minute] = time
    ? time.split(":")
    : ["", ""];

  const updateTime = (
    nextHour: string,
    nextMinute: string,
  ) => {
    if (nextHour && nextMinute) {
      onTimeChange(
        `${nextHour}:${nextMinute}`,
      );
    }
  };

  return (
    <div>
      <span className="mb-2 block text-sm font-semibold">
        라이브 일시
      </span>

      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
        <input
          type="date"
          value={date}
          onChange={(event) =>
            onDateChange(
              event.target.value,
            )
          }
          className="rounded-xl border px-3 py-3"
        />

        <select
          value={hour}
          onChange={(event) =>
            updateTime(
              event.target.value,
              minute || "00",
            )
          }
          className="rounded-xl border px-3 py-3"
        >
          <option value="">시</option>
          {LIVE_HOURS.map((value) => (
            <option
              key={value}
              value={value}
            >
              {value}시
            </option>
          ))}
        </select>

        <select
          value={minute}
          onChange={(event) =>
            updateTime(
              hour || "00",
              event.target.value,
            )
          }
          className="rounded-xl border px-3 py-3"
        >
          <option value="">분</option>
          {LIVE_MINUTES.map((value) => (
            <option
              key={value}
              value={value}
            >
              {value}분
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold">
        {label}
      </span>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="w-full rounded-xl border px-4 py-3"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="w-full rounded-xl border px-4 py-3"
      >
        <option value="">
          {placeholder}
        </option>

        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function TypeButton({
  icon,
  title,
  onClick,
}: {
  icon: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border bg-white p-8 text-left hover:border-blue-500 hover:shadow-lg"
    >
      <div className="text-4xl">
        {icon}
      </div>

      <h2 className="mt-5 text-xl font-bold">
        {title}
      </h2>
    </button>
  );
}

function ErrorBox({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message}
    </div>
  );
}

type RouteColumnVariants = {
  departure: Blob[];
  arrival: Blob[];
};

async function createRouteColumnVariants(
  file: File,
): Promise<RouteColumnVariants> {
  const image = await createImageBitmap(file);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;
  const context = sourceCanvas.getContext("2d");

  if (!context) {
    throw new Error("이미지를 처리하지 못했습니다.");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );

  const verticalLines = findVerticalTableLines(
    imageData,
    sourceCanvas.width,
    sourceCanvas.height,
  );
  const columns = resolveRouteColumns(
    verticalLines,
    sourceCanvas.width,
  );

  const departure: Blob[] = [];
  const arrival: Blob[] = [];

  for (const threshold of [190, 215, 235]) {
    departure.push(
      await cropAndPrepareColumn(
        image,
        columns.departureLeft,
        0,
        columns.departureRight - columns.departureLeft,
        image.height,
        threshold,
      ),
    );
    arrival.push(
      await cropAndPrepareColumn(
        image,
        columns.arrivalLeft,
        0,
        columns.arrivalRight - columns.arrivalLeft,
        image.height,
        threshold,
      ),
    );
  }

  return { departure, arrival };
}

function findVerticalTableLines(
  imageData: ImageData,
  width: number,
  height: number,
): number[] {
  const candidates: number[] = [];

  for (let x = 0; x < width; x += 1) {
    let dark = 0;
    for (let y = 0; y < height; y += 1) {
      const index = (y * width + x) * 4;
      const gray =
        imageData.data[index] * 0.299 +
        imageData.data[index + 1] * 0.587 +
        imageData.data[index + 2] * 0.114;
      if (gray < 245) dark += 1;
    }

    if (dark / height > 0.55) {
      candidates.push(x);
    }
  }

  return groupLinePositions(candidates);
}

function groupLinePositions(
  candidates: number[],
): number[] {
  const groups: number[][] = [];
  for (const value of candidates) {
    const last = groups[groups.length - 1];
    if (last && value - last[last.length - 1] <= 3) {
      last.push(value);
    } else {
      groups.push([value]);
    }
  }
  return groups.map((group) =>
    Math.round(
      group.reduce((sum, value) => sum + value, 0) /
        group.length,
    ),
  );
}

function resolveRouteColumns(
  lines: number[],
  imageWidth: number,
) {
  const sorted = lines
    .filter((value) => value >= 0 && value <= imageWidth)
    .sort((a, b) => a - b);

  if (sorted.length >= 4) {
    const boundaries = sorted.slice(-4);
    return {
      departureLeft: boundaries[1] + 3,
      departureRight: boundaries[2] - 3,
      arrivalLeft: boundaries[2] + 3,
      arrivalRight: boundaries[3] - 3,
    };
  }

  return {
    departureLeft: Math.floor(imageWidth * 0.23),
    departureRight: Math.floor(imageWidth * 0.80),
    arrivalLeft: Math.floor(imageWidth * 0.80),
    arrivalRight: imageWidth - 1,
  };
}

async function cropAndPrepareColumn(
  image: ImageBitmap,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  threshold: number,
): Promise<Blob> {
  const scale = 3;
  const padding = 12;
  const canvas = document.createElement("canvas");
  canvas.width = (sourceWidth + padding * 2) * scale;
  canvas.height = (sourceHeight + padding * 2) * scale;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("노선 열을 처리하지 못했습니다.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    padding * scale,
    padding * scale,
    sourceWidth * scale,
    sourceHeight * scale,
  );

  const imageData = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  for (let index = 0; index < imageData.data.length; index += 4) {
    const gray =
      imageData.data[index] * 0.299 +
      imageData.data[index + 1] * 0.587 +
      imageData.data[index + 2] * 0.114;
    const value = gray < threshold ? 0 : 255;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("이미지 변환에 실패했습니다."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function createWholeImageVariants(
  file: File,
): Promise<Blob[]> {
  const image =
    await createImageBitmap(file);

  const variants: Blob[] = [];

  for (const threshold of [190, 215, 235]) {
    variants.push(
      await cropAndPrepareColumn(
        image,
        0,
        0,
        image.width,
        image.height,
        threshold,
      ),
    );
  }

  return variants;
}

type OcrWord = {
  text: string;
  x: number;
  y: number;
};

type OcrPageLike = {
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: Array<{
        words?: Array<{
          text: string;
          bbox: {
            x0: number;
            y0: number;
            x1: number;
            y1: number;
          };
        }>;
      }>;
    }>;
  }> | null;
};

function collectOcrWords(
  page: OcrPageLike,
): OcrWord[] {
  const words: OcrWord[] = [];

  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = word.text
            .trim()
            .toUpperCase();

          if (!text) {
            continue;
          }

          words.push({
            text,
            x:
              (word.bbox.x0 +
                word.bbox.x1) /
              2,
            y:
              (word.bbox.y0 +
                word.bbox.y1) /
              2,
          });
        }
      }
    }
  }

  return words;
}

// 표가 아니라 이미지 전체에서 공항코드를 다시 찾을 때 씁니다.
// - 카드형 이미지처럼 도착 공항코드만 흩어져 있는 경우
// - 출발지·권역별로 셀이 합쳐진 할인 노선표처럼, 한 셀에 여러
//   도착 코드가 "NGO/KKJ/TAK" 식으로 붙어 있는 경우
// 단어의 세로 좌표(y)를 이용해 "가장 최근에 등장한 출발 공항코드"를
// 계속 이어받는 방식으로, 출발지별 그룹을 나눕니다.
function extractRoutesFromOcrWords(
  words: OcrWord[],
  excludedCodes: Set<string>,
): RouteItem[] {
  type DepartureGroup = {
    y: number;
    code: string;
  };

  type ArrivalWord = {
    y: number;
    codes: string[];
    explicitDeparture?: string;
  };

  const departureGroups: DepartureGroup[] =
    [];
  const arrivalWords: ArrivalWord[] = [];

  for (const word of words) {
    const codes =
      findAllAirportCodesInToken(
        word.text,
      );

    if (codes.length === 0) {
      continue;
    }

    const departureCodesInWord =
      codes.filter((code) =>
        DEPARTURE_CODES.has(code),
      );
    const arrivalCodesInWord =
      codes.filter(
        (code) =>
          !DEPARTURE_CODES.has(
            code,
          ),
      );

    if (arrivalCodesInWord.length === 0) {
      // 출발 공항코드만 담긴 단어 → 출발지 그룹의 기준점
      for (const code of departureCodesInWord) {
        departureGroups.push({
          y: word.y,
          code,
        });
      }
      continue;
    }

    arrivalWords.push({
      y: word.y,
      codes: arrivalCodesInWord,
      // 같은 단어에 출발코드가 함께 있으면(예: "ICN-NRT") 그대로 사용
      explicitDeparture:
        departureCodesInWord[0],
    });
  }

  departureGroups.sort(
    (a, b) => a.y - b.y,
  );

  const resolveDeparture = (
    y: number,
  ): string => {
    if (departureGroups.length === 0) {
      // 출발 공항코드를 전혀 못 찾았다면 인천(ICN)을 기본값으로 씁니다.
      return "ICN";
    }

    let result =
      departureGroups[0].code;

    for (
      let index = 0;
      index < departureGroups.length - 1;
      index += 1
    ) {
      const boundary =
        (departureGroups[index].y +
          departureGroups[index + 1]
            .y) /
        2;

      if (y >= boundary) {
        result =
          departureGroups[index + 1]
            .code;
      }
    }

    return result;
  };

  const routes: RouteItem[] = [];

  for (const arrivalWord of arrivalWords) {
    const departureCode =
      arrivalWord.explicitDeparture ??
      resolveDeparture(arrivalWord.y);

    for (const arrivalCode of arrivalWord.codes) {
      if (
        excludedCodes.has(
          arrivalCode,
        ) ||
        arrivalCode === departureCode
      ) {
        continue;
      }

      const destination =
        AIRPORTS[arrivalCode];

      if (!destination) {
        continue;
      }

      routes.push({
        region: destination.region,
        departureCode,
        arrivalCode,
        arrivalCity: destination.city,
        price: "",
        highlighted: false,
      });
    }
  }

  return routes;
}

// 표 하단의 "*RMQ, LJ736/7 제외" 같은 각주에 언급된 공항코드는
// 노선 추출에서 자동으로 제외합니다.
function extractFootnoteExcludedCodes(
  text: string,
): Set<string> {
  const excluded = new Set<string>();

  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!/^[*※]/.test(line)) {
      continue;
    }

    for (const code of findAllAirportCodesInToken(
      line.toUpperCase(),
    )) {
      excluded.add(code);
    }
  }

  return excluded;
}

// 한 단어(토큰) 안에 붙어 있는 공항코드를 모두 찾습니다.
// "NGO/KKJ/TAK"처럼 구분자 없이 이어져도 3글자씩 겹치지 않게 스캔합니다.
function findAllAirportCodesInToken(
  token: string,
): string[] {
  const codes: string[] = [];
  let index = 0;

  while (index <= token.length - 3) {
    const raw = token.slice(
      index,
      index + 3,
    );
    const repaired =
      repairAirportCode(raw).find(
        (candidate) =>
          AIRPORTS[candidate],
      );

    if (repaired) {
      codes.push(repaired);
      index += 3;
    } else {
      index += 1;
    }
  }

  return codes;
}

function chooseBestCodeSequence(
  texts: string[],
  departureOnly: boolean,
): string[] {
  const sequences = texts.map((text) =>
    extractAirportCodeSequence(text, departureOnly),
  );
  return sequences.sort((a, b) => b.length - a.length)[0] ?? [];
}

function findValidCodeIn(
  chars: string,
  departureOnly: boolean,
): string {
  for (
    let index = 0;
    index <= chars.length - 3;
    index += 1
  ) {
    const raw = chars.slice(index, index + 3);
    const repaired = repairAirportCode(
      raw,
    ).find((candidate) => {
      if (!AIRPORTS[candidate]) return false;
      return departureOnly
        ? DEPARTURE_CODES.has(candidate)
        : !DEPARTURE_CODES.has(candidate);
    });
    if (repaired) {
      return repaired;
    }
  }
  return "";
}

function extractAirportCodeSequence(
  text: string,
  departureOnly: boolean,
): string[] {
  const rawLines = text
    .toUpperCase()
    .replace(/\r/g, "\n")
    .split("\n");

  const result: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      continue;
    }

    // "치앙마이 (CNX)"처럼 코드 앞에 한글 도시명이 있으면, OCR 화이트리스트
    // 때문에 한글이 엉뚱한 로마자로 오인식되어 실제 코드보다 먼저 우연히
    // 유효한 코드(예: SEA)처럼 읽힐 수 있습니다. 그래서 괄호 안 코드를
    // 최우선으로 찾고, 괄호가 없을 때만 줄 전체를 훑습니다.
    let code = "";

    for (const match of rawLine.matchAll(
      /\(([A-Z0-9]{2,4})\)/g,
    )) {
      const candidate = findValidCodeIn(
        match[1],
        departureOnly,
      );
      if (candidate) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      code = findValidCodeIn(
        rawLine.replace(/[^A-Z0-9]/g, ""),
        departureOnly,
      );
    }

    if (code) {
      result.push(code);
    }
  }

  return result;
}

function normalizeDepartureSequence(
  departureCodes: string[],
  targetLength: number,
): string[] {
  if (departureCodes.length === targetLength) {
    return departureCodes;
  }

  const unique = Array.from(new Set(departureCodes));
  if (unique.length === 1) {
    return Array(targetLength).fill(unique[0]);
  }

  if (departureCodes.length === 0) {
    return Array(targetLength).fill("ICN");
  }

  const result = [...departureCodes];
  while (result.length < targetLength) {
    result.push(result[result.length - 1]);
  }
  return result.slice(0, targetLength);
}

function repairAirportCode(value: string): string[] {
  const substitutions: Record<string, string[]> = {
    "0": ["O"],
    "1": ["I"],
    "5": ["S"],
    "8": ["B"],
    "6": ["G"],
    "2": ["Z"],
  };

  let candidates = [value];
  for (let index = 0; index < value.length; index += 1) {
    const replacements = substitutions[value[index]];
    if (!replacements) continue;
    const expanded = [...candidates];
    for (const candidate of candidates) {
      for (const replacement of replacements) {
        expanded.push(
          candidate.slice(0, index) +
            replacement +
            candidate.slice(index + 1),
        );
      }
    }
    candidates = expanded;
  }
  return Array.from(new Set(candidates));
}


function mergeRoutes(
  currentRoutes: RouteItem[],
  newRoutes: RouteItem[],
): RouteItem[] {
  const merged = new Map<
    string,
    RouteItem
  >();

  for (const route of [
    ...currentRoutes,
    ...newRoutes,
  ]) {
    const departureCode =
      route.departureCode
        .trim()
        .toUpperCase();
    const arrivalCode =
      route.arrivalCode
        .trim()
        .toUpperCase();

    if (
      !departureCode ||
      !arrivalCode
    ) {
      continue;
    }

    const key =
      `${departureCode}-${arrivalCode}`;

    if (!merged.has(key)) {
      merged.set(key, {
        ...route,
        departureCode,
        arrivalCode,
      });
    }
  }

  return Array.from(
    merged.values(),
  );
}

function stringsToRange(
  start: string,
  end: string,
): DateRange | undefined {
  if (!start) {
    return undefined;
  }

  return {
    from: stringToDate(start),
    to: end
      ? stringToDate(end)
      : undefined,
  };
}

function stringToDate(
  value: string,
) {
  const [year, month, day] =
    value
      .split("-")
      .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  );
}

function dateToString(
  date: Date,
) {
  const year =
    date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(
  value: string,
) {
  const date =
    stringToDate(value);

  return `${date.getFullYear()}.${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
