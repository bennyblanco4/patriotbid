// Guide text. Every factual claim comes from the DLA pages listed in each
// guide's sources; check them again before changing a fact.

export type Guide = {
  slug: string;
  title: string;
  description: string;
  body: React.ReactNode;
  sources: { label: string; url: string }[];
};

const REGISTRATION = {
  label: "DLA: DIBBS Vendor Registration (revised Aug 27, 2024)",
  url: "https://www.dla.mil/Vendor-Information-Hub/Table-of-Contents/Details/Article/3746012/dla-internet-bid-board-system-dibbs-vendor-registration/",
};
const MASTER = {
  label: "DLA Master Solicitation for Automated Simplified Acquisitions (May 20, 2026)",
  url: "https://www.dla.mil/Portals/104/Documents/J7Acquisition/FinalMasterSolicitationForAutomatedSimplifiedAcquisitionsRevision5-20-26.pdf",
};
const PIID = {
  label: "DLA: How to read a PIID number",
  url: "https://www.dla.mil/Aviation/Business/Vendor-Information-Hub/Table-of-Contents/Details/Article/3600954/how-to-read-a-contractorder-procurement-instrument-identification-piid-number/",
};
const NSN = {
  label: "DLA: National Stock Numbers",
  url: "https://www.dla.mil/Disposition-Services/DDSR/Quick-Links/NSNs/",
};

export const guides: Guide[] = [
  {
    slug: "how-to-bid-on-dibbs",
    title: "How to bid on DIBBS, from registration to your first quote",
    description:
      "The steps to quote on DLA's bid board: SAM.gov, your CAGE code, DIBBS registration and the postcard, then finding and submitting an RFQ.",
    sources: [REGISTRATION, MASTER],
    body: (
      <>
        <p>
          DIBBS, the DLA Internet Bid Board System, is where the Defense Logistics Agency
          posts requests for quotes (RFQs), requests for proposals and invitations for bids,
          and where vendors answer them. Plan for at least ten days to get set up, because
          the last registration step waits on a postcard.
        </p>

        <h2>1. Register in SAM.gov</h2>
        <p>
          DIBBS needs an active SAM.gov registration, and your CAGE code is issued at the end
          of it. DIBBS takes your company name and address from SAM.gov and will not let you
          edit them; make changes in SAM.gov and DIBBS picks them up in its daily update.
        </p>

        <h2>2. Register your CAGE in DIBBS</h2>
        <ol>
          <li>Open DIBBS, accept the terms and choose Vendor Registration.</li>
          <li>
            Enter your <a href="/guides/what-is-a-cage-code">CAGE code</a> and confirm the
            mailing address. If it is wrong, stop and have the SAM.gov Federal Service Desk
            correct it first.
          </li>
          <li>
            Name the Super User. Each CAGE has exactly one, and only that person can change
            the account or add users.
          </li>
          <li>Enter the PIN that DIBBS emails to the Super User.</li>
          <li>
            Request the postcard with your Physical Address Verification Number. It takes
            about ten days to arrive, and registration cannot continue until you enter it.
          </li>
          <li>
            Accept the user agreement, set a password and three challenge questions, fill in
            your supplier defaults and submit.
          </li>
        </ol>
        <p>
          Your Super User ID is your CAGE code followed by <code>01</code>. Other staff get
          accounts <code>02</code> to <code>99</code>.
        </p>

        <h2>3. Choose your notifications</h2>
        <p>
          The supplier defaults let DIBBS email you new solicitations that match your federal
          supply classes, NSNs or approved manufacturer CAGE codes, up to 3,000 values of
          each. Quotes are valid for 90 days unless you change it. Award notices go only to
          the primary email address, so keep that one current.
        </p>

        <h2>4. Find RFQs worth quoting</h2>
        <p>
          DLA posts about 2,000 RFQs each business day. <a href="/dashboard">Bid Prospect's
          daily list</a> shows them with plain category names, set-aside badges and the award
          method, and each <a href="/guides/what-is-an-nsn">NSN</a> page keeps the past award
          prices and approved sources from earlier solicitations. Read the solicitation PDF
          before you price anything: it names the part numbers DLA will accept, the unit of
          issue and the procurement history.
        </p>

        <h2>5. Submit the quote on DIBBS</h2>
        <p>
          Quotes on automated solicitations must be entered on DIBBS; DLA does not consider
          automated quotes sent by other electronic means. The automated evaluation only
          looks at quotes that meet the solicitation exactly, entered as a bid without
          exception. <a href="/guides/how-dla-awards-dibbs-rfqs">How DLA awards RFQs</a>{" "}
          covers what that means.
        </p>
      </>
    ),
  },
  {
    slug: "what-is-a-cage-code",
    title: "What is a CAGE code?",
    description:
      "The five character Commercial and Government Entity code: how you get one, how DIBBS uses it, and what the CAGE codes printed in an RFQ tell you.",
    sources: [REGISTRATION, MASTER],
    body: (
      <>
        <p>
          A CAGE (Commercial and Government Entity) code is a five character code of letters
          and numbers that identifies a company to the government. A DLA solicitation uses
          CAGE codes three ways: to identify you, the maker of each approved part, and the
          companies that won before.
        </p>

        <h2>How you get one</h2>
        <p>
          Your CAGE code is issued at the end of your SAM.gov registration. You need it before
          you can start a <a href="/guides/how-to-bid-on-dibbs">DIBBS registration</a>, and
          the DIBBS account is opened under it: the Super User signs in as the CAGE code
          followed by <code>01</code>.
        </p>

        <h2>Approved sources</h2>
        <p>
          When an item is described by a manufacturer's part number, the solicitation lists
          each approved manufacturer by name, CAGE code and part number. Those are the parts
          DLA will accept. For automated awards, quoting a superseding or previously approved
          part number, or a correction to the CAGE and part number cited, does not by itself
          disqualify the quote.
        </p>

        <h2>Past winners</h2>
        <p>
          The procurement history in a solicitation lists earlier awards with the winning
          CAGE code, contract number, quantity, unit price and date. Bid Prospect's NSN pages
          show that table and put a company name next to the CAGE when it matches an approved
          source.
        </p>

        <h2>Alerts by CAGE</h2>
        <p>
          DIBBS can email you new solicitations that name approved manufacturer CAGE codes
          you choose, which is a quick way to follow every request for parts from the
          makers you distribute.
        </p>
      </>
    ),
  },
  {
    slug: "how-dla-awards-dibbs-rfqs",
    title: "How DLA awards DIBBS RFQs: automated evaluation or buyer review",
    description:
      "What a DLA solicitation number tells you, how the automated evaluation picks quotes, and which quotes it will consider.",
    sources: [MASTER, PIID],
    body: (
      <>
        <p>
          A solicitation number tells you who issued an RFQ and whether a computer or a buyer
          will evaluate it. Take <code>SPE4A6-26-T-1492</code>:
        </p>
        <ul>
          <li>
            <strong>SPE4A6</strong> is the issuing DLA office. SPE4 is Weapons Support in
            Richmond, SPE7 is Weapons Support in Columbus and SPE8 is Troop Support.
          </li>
          <li>
            <strong>26</strong> is the fiscal year, which runs from October 1 to September 30.
          </li>
          <li>
            <strong>T</strong>, the ninth character, is the type of solicitation.
          </li>
          <li>
            <strong>1492</strong> is the number DLA assigned.
          </li>
        </ul>

        <h2>T and U mean automated</h2>
        <p>
          DLA's Master Solicitation identifies automated solicitations by SPE in the first
          three positions and T or U in the ninth. Quotes on them must be entered on DIBBS.
          Any other ninth letter means the request is outside the automated program and a
          buyer evaluates it, which is how Bid Prospect labels it.
        </p>

        <h2>How the automated evaluation works</h2>
        <p>
          The DLA Automated Evaluation program uses price reasonableness logic and other
          automated filters to make fully automated and buyer assisted awards up to the
          simplified acquisition threshold. It starts at the closing date and time and only
          considers qualified quotations: quotes entered on DIBBS that meet the solicitation
          exactly, with the bid type "bid without exception".
        </p>
        <p>These do not, on their own, make a quote ineligible:</p>
        <ul>
          <li>Quoting different delivery days than the solicitation asks for.</li>
          <li>
            Quoting a superseding or previously approved part, or a correction to the CAGE and
            part number cited.
          </li>
          <li>
            Quoting a used, reconditioned or remanufactured item, or unused former government
            surplus.
          </li>
          <li>Quoting a foreign end product on an unrestricted solicitation.</li>
          <li>Quoting a hazardous item.</li>
        </ul>

        <h2>Fast Auto Evaluation</h2>
        <p>
          Some solicitations carry a Fast Auto Evaluation icon in the DIBBS search results.
          They are estimated at or below the micro-purchase threshold, are not set aside, and
          may be awarded before the closing date, so quoting early matters.
        </p>

        <h2>Check before you quote</h2>
        <p>
          Bid Prospect shows the award method on every request in the{" "}
          <a href="/dashboard">daily list</a>, and you can filter by it. The solicitation
          itself is always the final word on how an RFQ is evaluated.
        </p>
      </>
    ),
  },
  {
    slug: "what-is-an-nsn",
    title: "What is an NSN? How to read a National Stock Number",
    description:
      "How the 13 digits of a National Stock Number break down into supply class, country code and item number, and how to use NSNs to find DLA RFQs.",
    sources: [NSN, REGISTRATION],
    body: (
      <>
        <p>
          A National Stock Number (NSN) is the 13 digit number federal agencies, including the
          Department of Defense, use to buy and manage supply items. NATO and its partners
          manage more than 8 million active items this way, and every DIBBS RFQ is for one or
          more NSNs.
        </p>

        <h2>The parts of an NSN</h2>
        <p>
          DLA's own example is <code>8415-01-530-2157</code>.
        </p>
        <ul>
          <li>
            <strong>8415</strong> is the Federal Supply Class (FSC). Its first two digits, 84,
            are the federal supply group, here clothing; there are 80 groups in all. The full
            class 8415 narrows it to special purpose clothing.
          </li>
          <li>
            <strong>01-530-2157</strong> is the National Item Identification Number (NIIN),
            which identifies the item itself.
          </li>
          <li>
            <strong>01</strong>, the first two digits of the NIIN, is the National
            Codification Bureau code for the country that assigned the number. Both 00 and 01
            mean the United States.
          </li>
          <li>
            <strong>530-2157</strong> is assigned in sequence so that each NSN is unique.
          </li>
        </ul>

        <h2>Using NSNs to find work</h2>
        <p>
          DIBBS can email you new solicitations for up to 3,000 NSNs you list. On Bid Prospect
          you can search the <a href="/dashboard">daily list</a> by NSN with or without
          dashes, open an NSN page for its request history, past awards and approved sources,
          or browse <a href="/category">categories</a> by supply group.
        </p>
      </>
    ),
  },
  {
    slug: "free-dibbs-search",
    title: "A free, faster way to search DIBBS",
    description:
      "What Bid Prospect adds to DLA's daily list of RFQs, and what you still do on DIBBS itself.",
    sources: [REGISTRATION],
    body: (
      <>
        <p>
          DIBBS is the official place to find and answer DLA requests for quotes, and every
          quote still goes through it. Bid Prospect reads the same public daily list and
          makes it quicker to decide which requests deserve your time.
        </p>

        <h2>What Bid Prospect adds</h2>
        <ul>
          <li>
            Plain names: supply class codes become categories such as Hardware or Medical, and
            set-asides become badges.
          </li>
          <li>
            The award method, read from the solicitation number.{" "}
            <a href="/guides/how-dla-awards-dibbs-rfqs">How that works</a>.
          </li>
          <li>Past award prices and approved sources from the solicitation PDF.</li>
          <li>
            Filters for category, supply class, set-aside, award method, deadline, minimum
            quantity and drawings, plus search by part name, NSN or solicitation number.
          </li>
          <li>A watchlist and CSV export, saved in your browser.</li>
          <li>
            NSN and <a href="/category">category</a> pages that keep the history across days.
          </li>
          <li>No fee. You sign in with Google or an email address.</li>
        </ul>

        <h2>What you still do on DIBBS</h2>
        <p>
          Registering your CAGE, submitting quotes, and receiving award notices and
          solicitation emails all happen on DIBBS. The{" "}
          <a href="/guides/how-to-bid-on-dibbs">bidding guide</a> walks through setup.
        </p>

        <h2>Where the data comes from</h2>
        <p>
          Bid Prospect stores each day of DIBBS's public RFQ listing. Fields DIBBS leaves blank
          stay blank, and every request links back to its DIBBS page and solicitation PDF so
          you can check the original.
        </p>
      </>
    ),
  },
];
