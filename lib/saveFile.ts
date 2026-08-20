// 아이폰 사파리는 Content-Disposition: attachment를 붙여도 이미지
// 링크를 그냥 열어서 보여주기만 하고 파일로 저장해주지 않는다(다운로드
// 폴더 개념이 데스크톱과 다름). 공유 시트(Web Share API)로 파일을
// 넘기면 "사진에 저장"을 직접 고를 수 있어서, 지원하는 환경에서는
// 그 방식을 먼저 시도하고 안 되면 기존 링크 이동으로 대체한다.
export async function saveOrShareFile(url: string, fileName: string): Promise<void> {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  if (nav.share && nav.canShare) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file] });
        return;
      }
    } catch (err) {
      // 사용자가 공유 시트를 취소한 경우엔 그냥 끝낸다 — 링크 이동으로
      // 대체하면 취소했는데 갑자기 새 화면이 뜨는 것처럼 보인다.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  window.location.href = url;
}
