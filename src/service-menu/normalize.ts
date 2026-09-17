import type { ServiceMenuEntry } from "./types";

/**
 * 토큰에서 꺼낸 값을 메뉴바에 넣을 수 있는 모양으로 **거른다**.
 *
 * ── 왜 묶음에 있나 ───────────────────────────────────────────────────────
 * 사이트는 이 목록을 ID 토큰의 `dss_services` 클레임에서 꺼낸다. 토큰은
 * 서명되어 있으니 위조는 아니지만, 그 안의 값이 **이번 판의 모양이라는
 * 보장은 없다** — 포털이 먼저 바뀌었거나, 옛 토큰을 든 사람이 들어왔거나,
 * 누가 등록값에 이상한 것을 넣었을 수 있다. 그때 화면이 통째로 죽는 것이
 * 가장 나쁜 결과다(메뉴바는 곁다리인데 본문까지 못 보게 된다).
 *
 * 이 걸름을 사이트마다 쓰면 다섯 벌이 된다. 그래서 묶음에 둔다.
 *
 * ── 🔴 여기서 권한을 판정하지 않는다 ─────────────────────────────────────
 * 없는 칸을 더하지 않고, 누가 어디에 들어갈 수 있는지 따지지 않는다. 그건
 * 포털만 아는 것이고(dss-auth 의 listAccessibleClients), 판정이 두 벌이
 * 되면 포털 타일과 메뉴바가 서로 다른 말을 하게 된다. 여기서 빼는 것은
 * **그릴 수 없는 칸**뿐이다.
 */

/**
 * 아이콘 글자 수 상한. 포털의 MAX_ICON_LENGTH 와 같은 값이고 같은 이유다 —
 * 등록값에 data: URI 같은 그림이 들어오면 메뉴바 한 줄이 통째로 밀린다.
 * 16: 국기·가족 이모지처럼 코드 포인트가 ZWJ 로 여럿 묶인 것도 이 안에 든다.
 */
export const MAX_ICON_LENGTH = 16;

/**
 * 링크로 그려도 되는 주소인가.
 *
 * `javascript:` · `data:` 같은 주소는 **서비스 주소일 수가 없다**. 정상
 * 경로로는 들어올 일이 없지만(포털 관리자만 등록값을 넣는다), 들어오면
 * 클릭 한 번이 그 화면에서 스크립트를 실행하는 문이 된다. 다른 서비스로
 * 건너가는 링크에 그런 값이 필요한 경우는 없으므로, 아예 못 그리게 한다.
 *
 * 허용: `http://…` · `https://…` · `/…`(같은 사이트의 절대 경로).
 * `//host` 같은 프로토콜 생략 주소는 허용하지 않는다 — 사내망은 http 와
 * https 가 섞여 있어 어느 쪽으로 붙을지 주소만 보고 알 수 없다.
 *
 * ⚠️ 아래 두 접두사 문자열 뒤에 호스트 이름을 붙여 「예시」로 만들지 마라.
 * 이 묶음에 박힌 주소가 하나도 없다는 것을 no-network.test.ts 가
 * `https?://영숫자` 로 찾아 못 박는다. 지금 모양이라야 통과한다.
 */
export function isSafeServiceUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  const lowered = url.toLowerCase();
  return lowered.startsWith("http://") || lowered.startsWith("https://");
}

/** 값이 있고 공백만은 아닌 문자열인지. 앞뒤 공백은 떼어 돌려준다. */
function trimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 아무 값이나 받아 메뉴바가 그릴 수 있는 칸만 남긴다.
 *
 * 받는 타입이 `unknown` 인 이유: 부르는 쪽은 대개 JWT 를 푼 결과라
 * 타입이 없다. 여기서 `as ServiceMenuEntry[]` 로 우기지 않고 실제로
 * 확인한다 — 우기는 순간 이 함수는 아무것도 막지 못한다.
 *
 * 규칙:
 *  - 배열이 아니면 빈 배열. (클레임이 아예 없거나 옛 토큰이면 여기로 온다)
 *  - id · name · url 중 하나라도 비면 버린다. 셋 다 그리는 데 꼭 필요하다.
 *  - 그릴 수 없는 주소(isSafeServiceUrl)는 버린다.
 *  - icon 은 없거나 길면 **아이콘만** 버린다. 칸은 남는다 — 아이콘 하나
 *    때문에 서비스가 목록에서 사라지는 편이 훨씬 나쁘다.
 *  - id 가 겹치면 **먼저 온 것만** 남긴다. 겹친 채로 두면 「지금 여기」가
 *    두 칸에 동시에 켜져 사용자가 자기 위치를 잘못 읽는다.
 *  - 차례는 받은 그대로다. 포털이 sort_order 로 이미 줄을 세웠으므로
 *    여기서 다시 정렬하면 포털 타일과 차례가 어긋난다.
 */
export function normalizeServiceMenu(input: unknown): ServiceMenuEntry[] {
  if (!Array.isArray(input)) return [];

  const menu: ServiceMenuEntry[] = [];
  const seen = new Set<string>();

  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) continue;
    const candidate = raw as Record<string, unknown>;

    const id = trimmedString(candidate.id);
    const name = trimmedString(candidate.name);
    const url = trimmedString(candidate.url);
    if (!id || !name || !url) continue;
    if (!isSafeServiceUrl(url)) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const entry: ServiceMenuEntry = { id, name, url };

    const icon = trimmedString(candidate.icon);
    if (icon && icon.length <= MAX_ICON_LENGTH) entry.icon = icon;

    menu.push(entry);
  }

  return menu;
}
