// Centralised brand assets so we change in one place.
export const SANKALP_LOGO =
  "https://customer-assets.emergentagent.com/job_lead-conversion-14/artifacts/lycugiiu_sankalp-logo.png";

export const SANKALP_TAGLINE_BN = "ঘর নয়, স্বপ্ন সাজাই আমরা";
export const SANKALP_TAGLINE_EN = "We Build Spaces. We Manage Business.";

export const SANKALP_CONTACT = {
  phone: "+91 9831105984",
  website: "www.sankalpinterior.com",
  address:
    "GB, Oishi Tower-II, Rabindra Pally, Jyangra, P.S — Baguiati, Jyangra To VIP Rd, Raghunathpur, Kolkata, West Bengal 700059",
};

export const Logo = ({ className = "h-10 w-auto" }) => (
  <img src={SANKALP_LOGO} alt="Sankalp Group" className={className} />
);
