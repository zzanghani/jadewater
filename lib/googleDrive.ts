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
