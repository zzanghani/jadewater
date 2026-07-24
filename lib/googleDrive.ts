import { google } from "googleapis";

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI
  );
}

// 최초 1회, 마스터 계정 소유의 구글 계정으로 Drive 접근을 허용받기 위한 동의 화면 URL.
export function getGoogleAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

function getDriveClient() {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: client });
}

// 공유 드라이브(Shared Drive) 안의 폴더에 만들 때는 supportsAllDrives를
// 켜줘야 한다 (안 켜면 "내 드라이브"만 대상으로 동작해서 실패한다).
export async function createDriveFolder(
  name: string,
  parentId?: string
): Promise<{ id: string; webViewLink: string }> {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  return { id: res.data.id!, webViewLink: res.data.webViewLink! };
}

// 같은 이름의 폴더가 parentId 밑에 이미 있으면 그걸 재사용하고, 없으면
// 새로 만든다. 카테고리별 폴더(마케팅/운영HR/...)를 매번 새로 만들지 않고
// 계속 같은 폴더에 쌓기 위해 쓴다.
export async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const drive = getDriveClient();
  const escapedName = name.replace(/'/g, "\\'");
  const q = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;

  const existing = await drive.files.list({
    q,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  return created.data.id!;
}

export async function uploadFileToDrive(params: {
  name: string;
  mimeType: string;
  buffer: Buffer;
  parentId: string;
}): Promise<string> {
  const drive = getDriveClient();
  const { Readable } = await import("node:stream");
  const res = await drive.files.create({
    requestBody: { name: params.name, parents: [params.parentId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id!;
}

// 한글을 포함한 텍스트를 PDF로 저장한다. pdf 라이브러리로 직접 그리면
// 한글 폰트를 따로 내장해야 해서, 대신 구글 자체 변환기를 빌린다:
// 텍스트 → 임시 구글독스 문서로 업로드(자동 변환) → PDF로 내보내기(export)
// → 최종 PDF만 남기고 임시 문서는 지운다.
export async function uploadTextAsPdf(params: {
  name: string; // 확장자 없이 (자동으로 .pdf 붙음)
  text: string;
  parentId: string;
}): Promise<string> {
  const drive = getDriveClient();
  const { Readable } = await import("node:stream");

  const tempDoc = await drive.files.create({
    requestBody: {
      name: `__temp_${params.name}`,
      mimeType: "application/vnd.google-apps.document",
      parents: [params.parentId],
    },
    media: { mimeType: "text/plain", body: Readable.from(Buffer.from(params.text, "utf-8")) },
    fields: "id",
    supportsAllDrives: true,
  });
  const tempDocId = tempDoc.data.id!;

  try {
    const exported = await drive.files.export(
      { fileId: tempDocId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    const pdfBuffer = Buffer.from(exported.data as ArrayBuffer);

    const finalFile = await drive.files.create({
      requestBody: { name: `${params.name}.pdf`, parents: [params.parentId] },
      media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
      fields: "id",
      supportsAllDrives: true,
    });
    return finalFile.data.id!;
  } finally {
    await drive.files.delete({ fileId: tempDocId, supportsAllDrives: true }).catch(() => {});
  }
}

// 서버(크론)에는 브라우저가 없어서 html2canvas 같은 화면 캡처는 못 쓴다.
// 대신 HTML을 올리면 구글독스가 자동 변환하면서 제목/굵게/표/색 같은
// 서식을 상당 부분 그대로 살려주기 때문에, 텍스트만 나열하는 것보다
// 화면에 보이는 모습에 훨씬 가까운 PDF가 나온다(완전히 동일한 픽셀
// 재현은 아니다). 폰트는 여기서도 구글 자체 변환기를 그대로 쓰므로
// 한글 폰트를 따로 내장할 필요가 없다.
export async function uploadHtmlAsPdf(params: {
  name: string; // 확장자 없이 (자동으로 .pdf 붙음)
  html: string;
  parentId: string;
}): Promise<string> {
  const drive = getDriveClient();
  const { Readable } = await import("node:stream");

  const tempDoc = await drive.files.create({
    requestBody: {
      name: `__temp_${params.name}`,
      mimeType: "application/vnd.google-apps.document",
      parents: [params.parentId],
    },
    media: { mimeType: "text/html", body: Readable.from(Buffer.from(params.html, "utf-8")) },
    fields: "id",
    supportsAllDrives: true,
  });
  const tempDocId = tempDoc.data.id!;

  try {
    const exported = await drive.files.export(
      { fileId: tempDocId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    const pdfBuffer = Buffer.from(exported.data as ArrayBuffer);

    const finalFile = await drive.files.create({
      requestBody: { name: `${params.name}.pdf`, parents: [params.parentId] },
      media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
      fields: "id",
      supportsAllDrives: true,
    });
    return finalFile.data.id!;
  } finally {
    await drive.files.delete({ fileId: tempDocId, supportsAllDrives: true }).catch(() => {});
  }
}
