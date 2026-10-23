import { useState } from "react";
import { Img } from "remotion";
import { CountUp, Pop, Rise, Scene } from "../components/motion";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fonts } from "../theme";

const AVATAR = 200;

const Avatar = ({
  name,
  photoUrl,
}: {
  readonly name: string;
  readonly photoUrl: string | null;
}) => {
  // A photo that won't load falls back to the initial rather than failing
  // the whole render.
  const [failed, setFailed] = useState(false);

  return (
    <div
      style={{
        width: AVATAR,
        height: AVATAR,
        borderRadius: "50%",
        overflow: "hidden",
        border: `6px solid ${colors.sun}`,
        backgroundColor: colors.sun,
        color: colors.forest700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...display(110),
      }}
    >
      {photoUrl && !failed ? (
        <Img
          src={photoUrl}
          maxRetries={1}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        name[0]?.toUpperCase()
      )}
    </div>
  );
};

export const Crew = ({ crew }: YearInReviewProps) => (
  <Scene background={colors.forest700} color={colors.cream}>
    <Rise delay={0.1}>
      <div style={{ ...lead, color: colors.forest200 }}>
        You cooked, served and scrubbed alongside
      </div>
    </Rise>
    <Rise delay={0.3} distance={140}>
      <div
        style={{
          ...display(crew.alongside >= 100 ? 420 : 500),
          color: colors.sun,
          marginTop: 24,
        }}
      >
        <CountUp value={crew.alongside} delay={0.3} />
      </div>
    </Rise>
    <Rise delay={0.6}>
      <div style={display(120)}>
        other {crew.alongside === 1 ? "volunteer" : "volunteers"}
      </div>
    </Rise>
    <div style={{ flex: 1 }} />
    {crew.friends.length > 0 && (
      <>
        <Rise delay={1.6}>
          <div style={{ ...body, fontWeight: 700, marginBottom: 40 }}>
            Your regular crew
          </div>
        </Rise>
        <div style={{ display: "flex", gap: 48 }}>
          {crew.friends.map((friend, i) => (
            <Pop key={friend.name} delay={1.8 + i * 0.15}>
              <Avatar name={friend.name} photoUrl={friend.photoUrl} />
              <div
                style={{
                  fontFamily: fonts.body,
                  fontWeight: 700,
                  fontSize: 40,
                  marginTop: 20,
                  width: AVATAR,
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {friend.name}
              </div>
              <div
                style={{
                  fontFamily: fonts.body,
                  fontWeight: 500,
                  fontSize: 34,
                  color: colors.forest200,
                  width: AVATAR,
                  textAlign: "center",
                }}
              >
                {friend.nights} {friend.nights === 1 ? "night" : "nights"}
              </div>
            </Pop>
          ))}
        </div>
      </>
    )}
  </Scene>
);
