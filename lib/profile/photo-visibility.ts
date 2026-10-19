/**
 * Visibility rules for a member's ORIGINAL main photo.
 * A chat alone only changes the progressive blur (11px -> 5px) and never
 * authorizes signing the original storage key.
 *
 * In a higher-risk region, accepted Meet Mode alone cannot reveal the main
 * image; an explicit mutual connection can. If region data is missing, fail
 * closed until both records are available.
 *
 * Album grants are separate and do not authorize a public main-image reveal.
 */
export function canRevealMainPhoto(args: {
  self: boolean;
  mutual: boolean;
  activeAcceptedMeet: boolean;
  viewerRisk: boolean | null;
  peerRisk: boolean | null;
}): boolean {
  if (args.self) return true;
  if (args.viewerRisk === null || args.peerRisk === null) return false;
  if (args.mutual) return true;
  return args.activeAcceptedMeet && args.viewerRisk === false && args.peerRisk === false;
}
