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
 * ── 🔴 펼치고 접는 것도 자바스크립트 없이 한다 ───────────────────────────
 * 머리말 안에 앉는 모습(variant="inline")은 드롭다운이지만 상태를 들지
 * 않는다. <details> + <summary> 라 **브라우저가 스스로** 펼치고 접고,
 * 안에 든 것은 여전히 평범한 <a href> 라 눌리면 그대로 나간다.
 * `<select onChange>` 로 만들면 스크립트가 붙기 전에는 아무 데도 갈 수
 * 없는데, 사내망에서는 스크립트가 늦게 붙는 일이 실제로 있다(개선요청
 * 머리말이 로그아웃 <form> 을 그대로 두는 것과 같은 이유다).
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
 * 아이콘이 **없는** 서비스를 좁은 화면에서 대신 가리키는 한 글자.
 *
 * 왜 필요한가: `variant="inline"` 의 단추는 폰(<768px)에서 이름을 눈에서
 * 감추고 아이콘만 보인다. 그런데 아이콘은 선택값이라(types.ts — 없으면 키
 * 자체가 없다) 그런 서비스에 있을 때 단추는 기본 아이콘 🔗 하나가 된다 —
 * **어느 시스템에 있는지 단추만 보고는 알 수 없다.** 이름의 첫 글자는
 * 서로 다를 가능성이 훨씬 크고("개"선요청 · "견"적), 한글·영문 모두 한
 * 칸에 들어간다.
 *
 * 🔴 빈 칸만은 남기지 않는다: 이름이 비어 있으면(정석대로면
 * normalizeServiceMenu 가 이미 걸렀을 값이다) 기본 아이콘으로 떨어진다.
 */
export function serviceInitial(name: string): string {
  // 코드 포인트로 자른다 — name[0] 은 이모지(서로게이트 쌍)를 반으로 쪼개
  // 깨진 글자 하나를 남긴다.
  return Array.from(name.trim())[0] ?? DEFAULT_SERVICE_ICON;
}

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

/**
 * **어디에 앉는가.** 사이트가 고른다 — 이 묶음은 스스로 알아내려 하지 않는다
 * (머리말의 구조는 사이트마다 다르고, 그것을 짐작하는 순간 틀리기 시작한다).
 *
 * - `"bar"`(기본): 머리말 **위**에 독립된 띠로 앉는다. 칸이 가로로 늘어서고,
 *   한 단 눌린 바탕에 지금 있는 칸만 머리말과 같은 색으로 떠 있는
 *   **브라우저 탭 은유**다.
 * - `"inline"`: 머리말 **안**에 **드롭다운 단추 하나**로 앉는다. 단추에는
 *   지금 있는 서비스가 서고(넓은 화면은 아이콘 + 이름, 폰은 아이콘만),
 *   누르면 전체 목록이 아래로 펼쳐진다. 가로로 늘어놓지 않으므로 서비스가
 *   다섯이든 열이든 **머리말이 차지하는 폭이 그대로다**(2026-09-18 사용자
 *   결정 — README 3절).
 *
 * 🔴 기본값이 `"bar"` 인 것은 되돌릴 수 없는 약속이다 — 이미 그 모습으로
 *    커밋된 사이트가 있다.
 */
export type ServiceMenuVariant = "bar" | "inline";

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
   *
   * `variant="inline"` 에서는 이 값이 **드롭다운 단추에 서는 얼굴**까지
   * 정한다. 모르면 단추는 아래 `label` 을 단다.
   */
  currentServiceId?: string | null;
  /**
   * 화면 낭독기가 읽을 이 띠의 이름. 사이트마다 부르는 말이 다를 수 있어
   * 열어 둔다(기본값은 그냥 두어도 된다).
   *
   * `variant="inline"` 에서 지금 있는 서비스를 모를 때는 이 글자가 그대로
   * 드롭다운 단추에 선다 — 눈에도 보이는 말이 되므로 사이트가 이 값을
   * 바꿀 때는 그것까지 생각해 고른다.
   */
  label?: string;
  /** 밝기를 무엇에 맞출지. 위 ServiceMenuColorScheme 참조. */
  colorScheme?: ServiceMenuColorScheme;
  /** 머리말 위(기본) 인가, 머리말 안인가. 위 ServiceMenuVariant 참조. */
  variant?: ServiceMenuVariant;
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
  variant = "bar",
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

  // 앉는 모습은 **클래스 하나**로 가른다. 기본값("bar")일 때는 클래스가 하나도
  // 늘지 않으므로, 이미 그 모습으로 커밋된 사이트들의 마크업이 글자 하나
  // 달라지지 않는다. 사이트가 준 className 은 늘 맨 뒤다(같은 우선순위면
  // 나중에 적힌 것이 이긴다 — 사이트 것이 이겨야 한다).
  const ownClasses = variant === "inline" ? "dss-menu dss-menu--inline" : "dss-menu";

  // ── 드롭다운 단추에 세울 얼굴(variant="inline" 일 때만 쓴다) ────────────
  //
  // 지금 있는 서비스를 알면 그 서비스를, 모르면 띠 이름(label)을 세운다.
  // 「모른다」는 실제로 생긴다: 사이트가 제 client_id 를 안 넘겼거나, 넘겼는데
  // 포털이 준 목록에 그 서비스가 없을 때다. 그때 단추가 비어 버리면 목록을
  // 펼칠 방법 자체가 사라지므로, 얼굴은 어떤 경우에도 하나 세운다.
  const current =
    currentServiceId === null || currentServiceId === undefined
      ? null
      : (drawable.find((service) => service.id === currentServiceId) ?? null);

  // 아이콘은 선택값이다. 아래 링크들과 **같은 기준**으로 본다(null 도 없는 것).
  const currentIcon = current === null ? null : (current.icon ?? null);

  // 폰에서 단추는 아이콘 하나로 줄어든다. 아이콘이 없는 서비스에 있으면 그
  // 단추가 🔗 하나가 되어 **어느 시스템에 있는지 알 수 없으므로**, 그 경우만
  // 이름 첫 글자를 대신 세운다(serviceInitial 참조). 지금 서비스를 모를 때는
  // 첫 글자를 딸 이름 자체가 없으니 기본 아이콘 하나로 둔다.
  const buttonInitial =
    current !== null && currentIcon === null ? serviceInitial(current.name) : null;
  const buttonIcon = currentIcon ?? DEFAULT_SERVICE_ICON;
  const buttonName = current === null ? label : current.name;

  const list = (
    <ul className="dss-menu__list">
      {drawable.map((service, index) => {
        // currentServiceId 가 없거나 목록에 없는 값이면 아무 칸도 켜지지
        // 않는다 — 그래도 띠는 멀쩡히 그려진다. 사이트가 자기 id 를
        // 잘못 넘긴 날 화면이 죽어서는 안 된다.
        const isCurrent = currentServiceId !== null && currentServiceId !== undefined && service.id === currentServiceId;

        // 포털이 이 칸에 아이콘을 실어 보냈는가. `?? DEFAULT_SERVICE_ICON`
        // 과 **같은 기준**으로 본다(null 도 없는 것으로 친다) — 기준이
        // 어긋나면 아이콘 자리에 아무것도 없는 칸이 생긴다.
        const ownIcon = service.icon ?? null;

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
              // ⚠️ 지금 이 값에 걸리는 CSS 규칙은 **없다.** 원래는 머리말
              // 안에 앉은 목록이 폰에서 아이콘만 보일 때 쓰였는데, 그 모습이
              // 드롭다운이 되면서(2026-09-18) 그 판단이 단추 쪽
              // (.dss-menu__summary)으로 옮겨 갔다 — 펼친 목록에서는 이름이
              // 늘 보이므로 아이콘이 없어도 헷갈리지 않는다.
              // 그래도 지우지 않는 이유는 하나뿐이다: 기본 모습("bar")의
              // 마크업을 글자 하나도 바꾸지 않기로 한 약속. 세 사이트가 모두
              // 새 모습으로 옮겨 간 뒤 따로 걷어낸다.
              data-has-icon={ownIcon === null ? "false" : "true"}
            >
              <span className="dss-menu__icon" aria-hidden="true">
                {ownIcon ?? DEFAULT_SERVICE_ICON}
              </span>
              {ownIcon === null && (
                // ⚠️ 위 data-has-icon 과 한 짝이고, 같은 이유로 **지금은
                // 어디에서도 보이지 않는다**(.dss-menu__initial 의 기본값이
                // display: none 이고, 그것을 켜 주는 규칙은 이제 단추에만
                // 걸린다). 기본 모습의 마크업을 지키려고 남겨 둔 것이다.
                <span className="dss-menu__initial" aria-hidden="true">
                  {serviceInitial(service.name)}
                </span>
              )}
              {/* 🔴 이름은 폰에서도 마크업에 남는다 — CSS 가 눈에서만
                  감춘다(clip). 이모지 하나만 읽히면 낭독기 사용자는 어디로
                  가는 링크인지 알 수 없다. */}
              <span className="dss-menu__name">{service.name}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav
      className={className ? `${ownClasses} ${className}` : ownClasses}
      aria-label={label}
      data-color-scheme={colorScheme}
    >
      {variant === "inline" ? (
        // 🔴 <details> 인 이유: 펼치고 접는 일을 **브라우저가** 한다. 상태도
        // 이벤트 핸들러도 없으므로 이 조각은 서버 컴포넌트로 남고, 스크립트가
        // 아직 안 붙은 화면에서도 눌러서 목록을 열고 링크로 나갈 수 있다.
        // <summary> 는 낭독기에 단추로 읽히고 펼침 여부(aria-expanded)도
        // 브라우저가 붙여 준다 — 우리가 손으로 달 것이 없다.
        <details className="dss-menu__dropdown">
          <summary
            className="dss-menu__summary"
            // 폰에서 무엇을 보일지 CSS 가 이 값으로 고른다. 뜻은 「아이콘
            // 자리에 그대로 보여도 되는 글자가 있는가」다 — "false" 일 때만
            // 아래 첫 글자가 대신 켜진다(두 값이 동시에 보이면 겹친다).
            data-has-icon={buttonInitial === null ? "true" : "false"}
          >
            <span className="dss-menu__icon" aria-hidden="true">
              {buttonIcon}
            </span>
            {buttonInitial !== null && (
              <span className="dss-menu__initial" aria-hidden="true">
                {buttonInitial}
              </span>
            )}
            {/* 🔴 이름은 폰에서도 마크업에 남는다 — CSS 가 눈에서만 감춘다
                (clip). 지우면 단추의 이름이 이모지 하나가 되어 낭독기
                사용자는 무엇을 여는 단추인지 알 수 없다. 펼침 삼각형은
                CSS(::after)가 그린다 — 뜻이 없는 글자라 마크업에 두지
                않는다. */}
            <span className="dss-menu__label">{buttonName}</span>
          </summary>
          {list}
        </details>
      ) : (
        list
      )}
    </nav>
  );
}
