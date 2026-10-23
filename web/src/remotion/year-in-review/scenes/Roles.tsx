import { Grow, Rise, Scene } from "../components/motion";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fonts } from "../theme";

const roleSize = (name: string) =>
  name.length <= 12 ? 170 : name.length <= 20 ? 132 : 112;

/** "Glen Innes", "Glen Innes and Onehunga", "A, B and C". */
const listNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export const Roles = ({ roles, locations }: YearInReviewProps) => {
  const [top] = roles;
  const ranked = roles.slice(0, 4);
  const [home, ...elsewhere] = locations;

  return (
    <Scene background={colors.sun} color={colors.forest700}>
      <Rise delay={0.1}>
        <div style={lead}>Your go-to role</div>
      </Rise>
      <Rise delay={0.3} distance={120} style={{ marginTop: 24 }}>
        <div style={display(roleSize(top.name))}>{top.name}</div>
      </Rise>
      {ranked.length > 1 && (
        <div
          style={{
            marginTop: 72,
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {ranked.map((role, i) => (
            <Rise key={role.name} delay={0.9 + i * 0.12} distance={40}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: fonts.body,
                  fontWeight: i === 0 ? 800 : 600,
                  fontSize: 40,
                  marginBottom: 10,
                }}
              >
                <span>{role.name}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {role.count}
                </span>
              </div>
              <Grow
                axis="x"
                delay={1 + i * 0.12}
                style={{
                  height: 18,
                  borderRadius: 9,
                  width: `${(role.count / top.count) * 100}%`,
                  backgroundColor:
                    i === 0 ? colors.forest700 : "rgba(14, 42, 28, 0.3)",
                }}
              />
            </Rise>
          ))}
        </div>
      )}
      <div style={{ flex: 1 }} />
      {home && (
        <Rise delay={2.2}>
          <div style={{ ...body, fontWeight: 700 }}>
            Home kitchen: {home.name}
          </div>
          {elsewhere.length > 0 && (
            <div style={{ ...body, marginTop: 12 }}>
              You also helped out at {listNames(elsewhere.map((l) => l.name))}.
            </div>
          )}
        </Rise>
      )}
    </Scene>
  );
};
