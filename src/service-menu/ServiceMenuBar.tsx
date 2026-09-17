import { isSafeServiceUrl } from "./normalize";
import type { ServiceMenuEntry } from "./types";

/**
 * 사내 시스템 사이를 건너다니는 **오가기 메뉴바**.
 *
 * 직원은 하루에도 A/S · 계측기 · 개선요청을 여러 번 옮겨 다니는데, 지금은
 * 그때마다 포털(/apps)로 돌아갔다 와야 한다. 이 띠가 각 사이트 머리말 위에
 * 앉아 한 번에 건너뛰게 한다.
 *
 * ── 🔴 이 조각은 자료를 가져오지 않는다 ──────────────────────────────────
 * fetch 도, 포털 주소도, 로그인도 모른다. **받은 목록을 그리기만 한다.**
 * 그래야 (1) 사이트마다 제 방식으로 목록을 구해 넣을 수 있고 — A/S 는
 * 세션에서, 계측기는 토큰에서 — (2) 시험이 브라우저도 서버도 없이 돌고,
 * (3) 이 묶음이 어느 사이트의 인증 방식에도 묶이지 않는다.
 * 실제로 그런지는 no-network.test.ts 가 이 폴더의 소스를 읽어 못 박는다.
 *
 * ── 서버 컴포넌트다("use client" 를 붙이지 않는다) ───────────────────────
 * 상태도 이벤트 핸들러도 없는 순수 표시 조각이다. 지시어가 없으면 서버에서
 * 그려질 수도 있고(njlee · dss-improvements 의 머리말처럼), "use client" 인
 * 껍데기 안에서 클라이언트 조각으로 그려질 수도 있다(A/S 의 AppShell).
 * 붙이는 순간 뒤쪽 한 가지만 가능해지므로 붙이지 않는다.
 *
 * ── next/link 를 쓰지 않는다 ─────────────────────────────────────────────
 * 여기 링크는 **다른 앱(다른 포트/다른 호스트)** 으로 가는 주소다. next/link
 * 의 클라이언트 전환은 같은 앱 안에서만 뜻이 있고, 밖으로 나가는 주소에는
 * 어차피 전체 이동이 된다. 평범한 <a> 로 두면 이 묶음이 next 에 의존하지
 * 않아도 되고, 시험도 next 없이 돈다.
 *
 * ── 스타일은 CSS 파일로 따로 온다 ────────────────────────────────────────
 * 여기서 `import "./service-menu.css"` 를 하지 않는다. 그 한 줄이 있으면
 * 번들러 없이는 이 파일을 부를 수 없게 되어 node 로 돌리는 시험이 깨진다.
 * 사이트가 제 최상위 layout 에서 한 번 불러 준다(README 참조).
 *
 * Tailwind 유틸리티 대신 제 클래스 이름을 쓰는 이유도 README 에 적어 두었다.
 * 요약: 다섯 사이트의 다크 모드 방식이 서로 다르다 — A/S 는 `.dark` 클래스,
 * 계측기는 아예 라이트 고정이다. `dark:` 유틸리티를 그대로 실으면 계측기에서
 * 이 띠만 OS 설정을 따라 까매진다.
 */

/**
 * 아이콘이 없는 서비스에 대신 그리는 글자.
 *
 * 포털 타일(/apps)이 쓰는 값과 같은 🔗 이다 — 같은 식구로 보여야 한다.
 * 빈 자리로 두지 않는 이유: 아이콘이 있는 칸과 없는 칸이 섞이면 이름의
 * 시작점이 칸마다 어긋나 띠가 들쭉날쭉해 보인다.
 */
export const DEFAULT_SERVICE_ICON = "🔗";

/**
 * 밝기를 무엇에 맞출지.
 *
 * - `"host"`(기본): 사이트를 따라간다. 조상에 `.dark` 나
 *   `[data-theme="dark"]` 가 있으면 어두워지고, 없으면 밝다. A/S 처럼
 *   클래스로 테마를 바꾸는 사이트, 계측기처럼 라이트로 고정한 사이트가
 *   **둘 다 옳게** 나오는 유일한 기본값이라 이것을 기본으로 둔다.
 * - `"light"` / `"dark"`: 사이트가 어떻든 이 띠만 고정한다.
 * - `"system"`: OS 설정(prefers-color-scheme)을 따른다. 사이트 전체가 그
 *   방식일 때만 고르라 — 아니면 띠만 따로 놀게 된다.
 */
export type ServiceMenuColorScheme = "host" | "light" | "dark" | "system";

export type ServiceMenuBarProps = {
  /**
   * 그릴 서비스 목록. **차례 그대로 그린다**(포털이 이미 줄을 세워 준다).
   * readonly 인 이유: 이 조각이 목록을 건드리지 않는다는 약속이고, 덕분에
   * 부르는 쪽이 얼려 둔 배열도 그대로 넘길 수 있다.
   */
  services: readonly ServiceMenuEntry[];
  /**
   * 지금 있는 서비스의 id(= 이 사이트의 client_id). 그 칸이 눌린 상태로
   * 그려진다. 모르면 넘기지 않아도 된다 — 아무 칸도 눌리지 않을 뿐이다.
   */
  currentServiceId?: string | null;
  /**
   * 화면 낭독기가 읽을 이 띠의 이름. 사이트마다 부르는 말이 다를 수 있어
   * 열어 둔다(기본값은 그냥 두어도 된다).
   */
  label?: string;
  /** 밝기를 무엇에 맞출지. 위 ServiceMenuColorScheme 참조. */
  colorScheme?: ServiceMenuColorScheme;
  /**
   * 사이트가 바깥 여백·위치를 보태고 싶을 때. 이 묶음의 클래스 뒤에
   * 붙으므로 사이트 것이 이긴다(같은 우선순위면 나중에 적힌 규칙이 이긴다).
   */
  className?: string;
};

export function ServiceMenuBar({
  services,
  currentServiceId = null,
  label = "사내 시스템 바로가기",
  colorScheme = "host",
  className,
}: ServiceMenuBarProps) {
  // 그릴 수 없는 주소는 여기서도 한 번 더 뺀다. normalizeServiceMenu 를
  // 거쳐 오는 것이 정석이지만, 사이트 다섯 곳 중 한 곳만 그 단계를
  // 빠뜨려도 구멍이 생긴다 — 값이 두 줄이라 양쪽에 두는 편이 싸다.
  // ⚠️ **권한 판정이 아니다.** 빼는 기준은 「링크로 그릴 수 없는 주소인가」
  //    하나뿐이고, 목록에 없는 것을 더하는 일은 없다.
  const drawable = services.filter((service) => isSafeServiceUrl(service.url));

  // 목록이 비면 **아무것도 그리지 않는다**(빈 띠를 남기지 않는다).
  //
  // 이 상태는 세 가지 뜻일 수 있다 — 권한이 없거나, 이 사이트만 쓸 수
  // 있거나, 아직 목록을 못 받았거나. 어느 쪽이든 사용자가 할 일은 없다.
  // 빈 회색 띠가 남으면 "뭔가 안 떴다"로 읽혀 문의가 들어오고, 안내 문구를
  // 넣으면 매 화면 위쪽을 잔소리가 차지한다. 그냥 없는 것이 맞다.
  if (drawable.length === 0) return null;

  return (
    <nav
      className={className ? `dss-menu ${className}` : "dss-menu"}
      aria-label={label}
      data-color-scheme={colorScheme}
    >
      <ul className="dss-menu__list">
        {drawable.map((service, index) => {
          // currentServiceId 가 없거나 목록에 없는 값이면 아무 칸도 켜지지
          // 않는다 — 그래도 띠는 멀쩡히 그려진다. 사이트가 자기 id 를
          // 잘못 넘긴 날 화면이 죽어서는 안 된다.
          const isCurrent = currentServiceId !== null && currentServiceId !== undefined && service.id === currentServiceId;

          return (
            // key 에 차례를 섞는다. id 가 겹친 목록(정석대로라면
            // normalizeServiceMenu 가 걸렀을)이 들어와도 React 가
            // 경고를 쏟지 않게 하기 위한 것이다.
            <li className="dss-menu__item" key={`${index}-${service.id}`}>
              <a
                className="dss-menu__link"
                href={service.url}
                // aria-current 는 「지금 보고 있는 쪽」의 표준 표시다. 색만으로
                // 알리지 않는다 — 화면 낭독기와 색약 사용자 모두에게 필요하다
                // (UI_GUIDELINE 7절).
                aria-current={isCurrent ? "page" : undefined}
                // 색을 고르는 열쇠는 CSS 에서도 이 속성이다. 클래스를
                // 갈아 끼우는 대신 속성을 쓰면, 사이트가 "지금 칸만 다르게"
                // 를 제 CSS 한 줄로 덮어쓸 수 있다.
                data-current={isCurrent ? "true" : "false"}
                data-service-id={service.id}
              >
                <span className="dss-menu__icon" aria-hidden="true">
                  {service.icon ?? DEFAULT_SERVICE_ICON}
                </span>
                <span className="dss-menu__name">{service.name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
