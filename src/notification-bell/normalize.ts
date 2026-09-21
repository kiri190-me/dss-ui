/**
 * 종이 받은 값을 **그릴 수 있는지**만 본다.
 *
 * ── 🔴 여기서 주소를 고치지 않는다 ───────────────────────────────────────
 * 걸러 낼 뿐이다. 앞에 무엇을 붙이는 순간 보낸 쪽이 이미 붙인 것과 겹쳐 두 번
 * 붙는다(포털의 merge.ts 가 같은 이유로 같은 선을 긋는다).
 */

/**
 * 링크로 그려도 되는 주소인가.
 *
 * 🔴 이 값은 **남의 시스템에서 온 글자**다. 포털이 한 번 걸러 보내지만, 종은
 * 포털 말고 다른 곳에서도 목록을 받을 수 있고(사이트가 제 알림을 직접 넣는
 * 경우 — A/S 가 그렇다) 사이트 다섯 곳 중 한 곳만 거름을 빠뜨려도 구멍이
 * 생긴다. `javascript:` 가 섞여 들어오면 클릭 한 번이 **그 화면에서 남의
 * 코드를 돌리는 문**이 되므로, 값이 두 줄인 이 검사를 양쪽에 둔다.
 *
 * 허용: `http://…` · `https://…` · `/…`(같은 사이트의 절대 경로).
 *  - 절대 경로를 받는 이유: 사이트가 **제 알림**을 이 종에 그대로 넣을 수
 *    있어야 한다. A/S 의 알림 주소는 `/inventory/requests` 처럼 상대 경로다
 *    (그쪽 domain/notifications.ts). 포털을 거쳐 온 줄은 이미 절대 주소다.
 *  - `//host` 같은 프로토콜 생략 주소는 막는다 — 사내망은 http 와 https 가
 *    섞여 있어 어느 쪽으로 붙을지 주소만 보고 알 수 없다.
 *
 * ⚠️ 아래 두 접두사 문자열 뒤에 호스트 이름을 붙여 「예시」로 만들지 마라.
 * 이 묶음에 박힌 주소가 하나도 없다는 것을 no-network.test.ts 가
 * `https?://영숫자` 로 찾아 못 박는다. 지금 모양이라야 통과한다.
 */
export function isSafeNotificationHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  const lowered = href.toLowerCase();
  return lowered.startsWith("http://") || lowered.startsWith("https://");
}
