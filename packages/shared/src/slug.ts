// Turns a name into a URL piece: "Joe's Café" -> "joe-s-cafe".
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// The public page address (publicBusinesses/{slug}) for a new business.
// When another place already uses the name, a short piece of the owner's id
// is added so two businesses never share (and overwrite) one listing.
export const businessSlug = (name: string, businessId: string, nameTaken: boolean) => {
  const base = slugify(name);
  if (!base || !nameTaken) return base;
  return `${base}-${businessId.slice(0, 6).toLowerCase()}`;
};
