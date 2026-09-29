import { useMemo } from "react";
import { Linking, Share, Text, View } from "react-native";
import QRCode from "qrcode";
import Svg, { Path, Rect } from "react-native-svg";

import WrongAccount from "@/components/gate";
import { Button, Card, colors, Muted, Screen, Title } from "@/components/ui";
import { useOwner } from "@/lib/session";
import { consumerUrl } from "@/lib/site-urls";

// A code customers scan to see live seats. Scans are tagged ?ref=qr so they
// show up in Analytics. For a printable sign, use the business website.
export default function QrScreen() {
  const owner = useOwner();
  const slug = owner?.business.status === "approved" ? owner.business.slug : undefined;
  const url = slug ? consumerUrl(`/place/${slug}?ref=qr`) : "";

  // One SVG path of every dark module.
  const code = useMemo(() => {
    if (!url) return null;
    const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
    let path = "";
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (modules.get(row, col)) path += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { size: modules.size, path };
  }, [url]);

  if (!owner) {
    return <WrongAccount />;
  }

  if (!code) {
    return (
      <Screen>
        <Title>QR code</Title>
        <Muted style={{ marginTop: 6 }}>Your QR code is ready once your business is approved and live.</Muted>
      </Screen>
    );
  }

  const margin = 4;
  const box = code.size + margin * 2;

  return (
    <Screen>
      <Card style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "800", letterSpacing: 1.5, color: colors.green }}>SEE OPEN SEATS</Text>
        <Text style={{ fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 6, textAlign: "center" }}>
          {owner.business.name}
        </Text>
        <View style={{ width: "100%", maxWidth: 320, aspectRatio: 1, marginTop: 16 }}>
          <Svg width="100%" height="100%" viewBox={`${-margin} ${-margin} ${box} ${box}`}>
            <Rect x={-margin} y={-margin} width={box} height={box} fill="#fff" />
            <Path d={code.path} fill={colors.ink} />
          </Svg>
        </View>
        <Muted style={{ marginTop: 12, textAlign: "center" }}>Scan with your phone camera to check live seats.</Muted>
      </Card>

      <Button
        title="Share link"
        onPress={() => void Share.share({ message: url }).catch(() => {})}
        style={{ marginTop: 16 }}
      />
      <Button
        title="Open customer page"
        variant="secondary"
        onPress={() => void Linking.openURL(url)}
        style={{ marginTop: 10 }}
      />
    </Screen>
  );
}
