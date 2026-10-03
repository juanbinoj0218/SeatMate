import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { DEFAULT_FEATURES, FEATURES_DOC, readFeatures, type Features } from "@seatmate/shared/features";

import { db } from "@/lib/firebase";

// Admin-controlled feature switches (settings/features), the same ones that
// turn parts of the website on and off. Loaded once per launch; everything
// counts as on until the settings say otherwise.

let cached: Features | null = null;
let pending: Promise<Features> | null = null;

function loadFeatures() {
  pending ??= getDoc(doc(db, ...FEATURES_DOC))
    .then((snapshot) => (cached = readFeatures(snapshot.data())))
    .catch(() => (cached = DEFAULT_FEATURES));
  return pending;
}

export function useFeatures(): Features {
  const [features, setFeatures] = useState<Features>(() => cached ?? DEFAULT_FEATURES);

  useEffect(() => {
    let active = true;
    loadFeatures().then((result) => {
      if (active) setFeatures(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return features;
}
