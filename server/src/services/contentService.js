/**
 * Template-based AI Content Generator for roofing marketing materials.
 *
 * Designed so a real LLM API (Claude, GPT) can replace the template engine
 * later — the public interface (generateContent / getTemplates) stays the same.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentSeason() {
  const m = new Date().getMonth(); // 0-11
  if (m >= 2 && m <= 4) return 'Spring';
  if (m >= 5 && m <= 7) return 'Summer';
  if (m >= 8 && m <= 10) return 'Fall';
  return 'Winter';
}

function fillTemplate(template, vars) {
  let text = template;
  for (const [key, val] of Object.entries(vars)) {
    text = text.replaceAll(`{${key}}`, val ?? '');
  }
  return text;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// TEMPLATES  —  5 types x 4 tones x 5-8 templates each
// ---------------------------------------------------------------------------

const templates = {
  // ========================================================================
  // SOCIAL POSTS
  // ========================================================================
  social_post: {
    urgent: [
      `⚠️ {city} was just hit by {hail_size}" hail! Your roof may be damaged. {company} offers FREE storm damage inspections. Don't wait — call us today! {phone}`,
      `🚨 STORM ALERT: {hail_size}" hail reported in {city}, {state}. If you haven't had your roof checked, NOW is the time. {company} — free inspections, zero obligation. {phone}`,
      `{city} homeowners: {hail_size}" hail can cause SERIOUS roof damage that isn't visible from the ground. {company} has crews ready for free inspections. Call {phone} before it's too late!`,
      `⛈️ After the {storm_date} storm, many {city} roofs have hidden damage. Don't file your insurance claim without a professional assessment first. {company} — {phone}`,
      `Your {city} roof just took a beating. {hail_size}" hail doesn't play around. Get a FREE inspection from {company} before leaks start. {phone}`,
      `ATTENTION {city}: The {storm_date} storm left damage across the area. {company} is scheduling free roof inspections this week. Spots are limited — {phone}`,
      `🔴 {hail_size}" hail = potential roof replacement. {city} residents, don't wait for a leak to find out. Free inspections from {company}. {phone}`,
    ],
    professional: [
      `{company} is now scheduling complimentary roof inspections for {city} homeowners. Our certified team provides detailed damage assessments and helps navigate insurance claims. Contact us: {phone}`,
      `Protect your investment. {company} offers professional {service} services in {city}, {state}. Licensed, insured, and trusted by hundreds of homeowners. {phone}`,
      `Looking for a reliable roofing contractor in {city}? {company} specializes in {service} with industry-leading warranties. Schedule your consultation today. {phone}`,
      `{company} — serving {city}, {state} with expert {service}. From initial inspection to final installation, we handle every detail. {phone} | {website}`,
      `Your roof is your home's first line of defense. {company} delivers quality {service} to {city} homeowners with transparent pricing and no surprises. {phone}`,
      `Trust the professionals. {company} has been providing {service} in {city} for years. GAF-certified. 5-star rated. Free estimates. {phone}`,
    ],
    friendly: [
      `Hey {city}! 👋 Your neighbors are already getting their roofs checked after the recent storm. Want a free inspection? {company} has you covered! {phone}`,
      `Thinking about a new roof? We make it easy! {company} offers hassle-free {service} for {city} homeowners. Give us a call — we'd love to help! {phone}`,
      `Happy {season}! It's the perfect time for a roof checkup. {company} offers free inspections in {city}. Let's make sure you're all set! {phone}`,
      `Your roof works hard for you every day. Time to return the favor! {company} in {city} — free inspections and honest recommendations. {phone} 🏠`,
      `Fun fact: most homeowners don't know their roof is damaged until it leaks. Let {company} take a look — it's free! Serving {city} and beyond. {phone}`,
      `We love helping our {city} neighbors! {company} is here for all your {service} needs. Call us anytime — {phone}. We'll treat your home like our own!`,
    ],
    seasonal: [
      `{season} is here, {city}! Time to make sure your roof is ready. {company} is offering seasonal roof checkups — call {phone} to schedule yours!`,
      `{season} storms can be brutal on roofs. Is yours ready? {company} provides free pre-{season} inspections for {city} homeowners. {phone}`,
      `Don't let {season} weather catch you off guard! {company} offers {service} to keep your {city} home protected all season long. {phone}`,
      `{season} roofing special! {company} is running limited-time pricing on {service} for {city} homeowners. Call {phone} before spots fill up!`,
      `The {season} season is the ideal time for {service}. {company} serves {city}, {state} with expert craftsmanship and honest pricing. {phone}`,
      `Is your roof ready for {season}? Most {city} homeowners find out too late. Get ahead with a free inspection from {company}! {phone}`,
    ],
  },

  // ========================================================================
  // DOOR HANGERS
  // ========================================================================
  door_hanger: {
    urgent: [
      {
        front: `⚠️ YOUR ROOF MAY BE DAMAGED — {hail_size}" hail hit {city} on {storm_date}`,
        back: `{company} is inspecting roofs in your neighborhood right now. Hail damage isn't always visible — but it leads to leaks, mold, and costly repairs. We offer FREE inspections and handle all insurance paperwork. Don't wait for the damage to get worse.\n\nCall {phone} or visit {website}\n\nLicensed & Insured | {city}, {state}`,
      },
      {
        front: `🚨 STORM DAMAGE ALERT — FREE Roof Inspections in {city}`,
        back: `Your area was hit by {hail_size}" hail on {storm_date}. Many of your neighbors already have damage they can't see. {company} provides fast, free inspections and works directly with your insurance company.\n\nCall NOW: {phone}\n{website}\n\n✓ Free inspection  ✓ Insurance claim help  ✓ Licensed & Insured`,
      },
      {
        front: `ACT FAST — Insurance claims have deadlines! Free storm damage inspection.`,
        back: `After the {storm_date} hailstorm ({hail_size}" reported), time is critical. Insurance companies set deadlines for filing claims. {company} will inspect your roof at no cost and help you file before it's too late.\n\n{phone} | {website}`,
      },
      {
        front: `{city} HOMEOWNERS: Your roof needs attention after the {storm_date} storm`,
        back: `Hail measuring {hail_size}" was reported in your area. This type of storm commonly causes:\n• Cracked or missing shingles\n• Granule loss\n• Dented gutters and flashing\n\n{company} offers FREE inspections. We handle your insurance claim start to finish.\n\nCall {phone} or visit {website}`,
      },
      {
        front: `Don't ignore storm damage — it only gets worse. FREE inspection inside →`,
        back: `Hi neighbor! {company} is your local roofing expert serving {city}, {state}. After the recent {hail_size}" hail event on {storm_date}, we're offering complimentary roof inspections.\n\nWhy act now?\n• Leaks can start within weeks\n• Insurance deadlines apply\n• Early detection saves thousands\n\n{phone} | {website}`,
      },
    ],
    professional: [
      {
        front: `{company} — Professional {service} for {city} homeowners`,
        back: `Thank you for being a valued member of the {city} community. {company} is a licensed, insured roofing contractor specializing in {service}.\n\nOur services include:\n• Complete roof inspections\n• Insurance claim assistance\n• Roof repair & replacement\n• Gutter installation\n\nSchedule your free consultation:\n{phone} | {website}`,
      },
      {
        front: `Protect your home with {city}'s trusted roofing experts`,
        back: `{company} has been serving {city}, {state} with quality {service}. We're GAF-certified, fully insured, and committed to excellence.\n\n✓ Free detailed inspections\n✓ Written estimates within 24 hours\n✓ Industry-leading warranties\n✓ Insurance claim navigation\n\n{phone} | {website}`,
      },
      {
        front: `Your roof. Your investment. Our expertise.`,
        back: `{company} provides top-tier {service} in {city}, {state}. We believe in transparency, quality materials, and craftsmanship that lasts.\n\nRequest your complimentary roof assessment today.\n\n{phone}\n{website}\n\nLicensed • Insured • {city}, {state}`,
      },
      {
        front: `Quality {service} — backed by warranty, built on trust`,
        back: `At {company}, we take pride in serving {city} homeowners with the highest standard of workmanship. Our team is fully certified and experienced in all aspects of {service}.\n\nContact us for a free estimate:\n{phone} | {website}`,
      },
      {
        front: `{company} — Licensed roofing professionals in {city}, {state}`,
        back: `Whether you need an inspection, repair, or full replacement, {company} is here to help. We work with all major insurance carriers and offer flexible financing options.\n\nFree estimates • 5-star reviews • Lifetime workmanship warranty\n\n{phone} | {website}`,
      },
    ],
    friendly: [
      {
        front: `Hi neighbor! 👋 We noticed storm damage in your area.`,
        back: `{company} is offering free roof inspections for {city} homeowners affected by the {storm_date} storm. Our certified team will assess your roof and help with insurance claims. No pressure, no obligation — just honest advice.\n\nCall {phone} or visit {website}`,
      },
      {
        front: `Your neighbors are getting their roofs checked — you should too!`,
        back: `Hey there! We're {company}, your friendly local roofer. We've been helping families in {city} with {service} and we'd love to help you too.\n\n🏠 Free inspection\n📋 Help with insurance\n⭐ 5-star service\n\nGive us a ring: {phone}\nOr visit: {website}`,
      },
      {
        front: `Need a roofer you can trust? We're right in your neighborhood!`,
        back: `Hi! {company} is a family-oriented roofing company serving {city}, {state}. We treat every home like our own.\n\nWhether you need a quick repair or a full roof replacement, we're here to help — no pressure, just great service.\n\n{phone} | {website}`,
      },
      {
        front: `We're {company} — and we're here to help! 🏠`,
        back: `Thanks for taking a moment to read this! We specialize in {service} right here in {city}. If your roof needs attention, we'd love to take a look — it's completely free.\n\nWe handle the insurance process too, so you don't have to stress.\n\nCall anytime: {phone}\n{website}`,
      },
      {
        front: `Roof worries? Let us take that off your plate! ✓`,
        back: `{company} makes roofing easy for {city} homeowners.\n\nStep 1: We inspect (free!)\nStep 2: We explain what we find (honestly!)\nStep 3: We fix it right (guaranteed!)\n\nSimple as that. Give us a call!\n{phone} | {website}`,
      },
    ],
    seasonal: [
      {
        front: `{season} Roofing Special — Free inspection for {city} homeowners!`,
        back: `{season} is the ideal time to check your roof before the next round of weather hits. {company} is offering free seasonal inspections to {city} residents.\n\nDon't wait for a leak — get ahead of the problem!\n\n{phone} | {website}`,
      },
      {
        front: `Is your roof ready for {season}? Let's find out — FREE!`,
        back: `{company} is running our annual {season} roof checkup program in {city}. We'll inspect your roof at no cost and let you know if anything needs attention.\n\n✓ No obligation\n✓ Same-day appointments available\n✓ Licensed & Insured\n\n{phone} | {website}`,
      },
      {
        front: `{season} storms are coming. Is your roof up to the task?`,
        back: `Every {season}, {city} homeowners discover roof problems the hard way. {company} helps you get ahead with a free professional inspection.\n\nWe offer:\n• Free inspections\n• {service}\n• Insurance claim support\n\n{phone} | {website}`,
      },
      {
        front: `Limited time: {season} roofing deals for {city} residents`,
        back: `Take advantage of our {season} pricing on {service}! {company} is booking fast in {city}, {state}.\n\n📞 Call {phone} today\n🌐 Visit {website}\n\nFree estimates • Financing available • 5-star rated`,
      },
      {
        front: `Prepare your home for {season} — start with your roof`,
        back: `Your roof takes the biggest beating every {season}. {company} is here to make sure your {city} home stays protected.\n\nSchedule your free {season} inspection:\n{phone}\n{website}\n\nServing {city}, {state} and surrounding areas`,
      },
    ],
  },

  // ========================================================================
  // EMAIL TEMPLATES
  // ========================================================================
  email_template: {
    urgent: [
      {
        subject: `URGENT: Your {city} roof may have storm damage — free inspection`,
        body: `Dear {first_name},\n\nOn {storm_date}, {city} was hit by a significant hailstorm with hail measuring up to {hail_size} inches in diameter. This type of storm commonly causes roof damage that isn't visible from the ground but can lead to serious problems if left unaddressed.\n\n{company} is currently in your neighborhood conducting free storm damage inspections. We'd like to offer you a complimentary assessment of your roof at no cost or obligation.\n\nWhy act now:\n• Insurance claims have filing deadlines\n• Unrepaired damage leads to leaks and mold\n• Early detection saves thousands in future repairs\n\nCall us at {phone} or visit {website} to schedule your free inspection.\n\nSincerely,\n{company}`,
      },
      {
        subject: `Storm damage in {city} — don't wait to get your roof checked`,
        body: `Hi {first_name},\n\nI hope this message finds you well. I'm reaching out because the recent storm on {storm_date} brought {hail_size}" hail to {city}, and many homeowners in your area are discovering roof damage.\n\nAt {company}, we're offering free, no-obligation roof inspections to help homeowners like you understand the condition of their roof after the storm.\n\nHere's what we provide:\n✓ Thorough roof inspection with photo documentation\n✓ Detailed damage report\n✓ Insurance claim assistance if damage is found\n✓ No cost, no pressure\n\nDon't wait until a small problem becomes a big one. Call us today at {phone}.\n\nBest regards,\n{company}\n{website}`,
      },
      {
        subject: `{first_name}, your roof needs attention after the {storm_date} storm`,
        body: `Dear {first_name},\n\nFollowing the severe weather that struck {city} on {storm_date}, our team at {company} has been assessing damage throughout the area. Hail measuring {hail_size}" was confirmed in your neighborhood.\n\nMany roofs in your area have sustained damage that requires professional evaluation. We are offering free inspections this week and can work directly with your insurance company.\n\nPlease call {phone} to schedule your inspection or visit {website} for more information.\n\nTime is of the essence — insurance companies may deny claims filed too late.\n\nRegards,\n{company}`,
      },
      {
        subject: `Act now: Free storm damage roof inspection in {city}`,
        body: `{first_name},\n\nThis is a courtesy notice from {company}. After the {storm_date} storm ({hail_size}" hail reported), we're providing free roof inspections in {city}.\n\nWe've already found significant damage on several homes in your area. Your roof may be affected too.\n\nWhat to expect:\n- 30-minute inspection at your convenience\n- Photo documentation of any findings\n- Help filing your insurance claim\n- Zero cost to you\n\nSchedule now: {phone}\n{website}\n\nBest,\n{company} Team`,
      },
      {
        subject: `{city} storm update: Is your roof safe?`,
        body: `Hi {first_name},\n\nThe {storm_date} hailstorm hit {city} hard — {hail_size}" hail can cause cracked shingles, compromised seals, and hidden damage that worsens over time.\n\n{company} is here to help. We offer:\n• Free professional roof inspections\n• Complete insurance claim management\n• Quality repairs and replacements\n• Financing options available\n\nYour roof protects everything you care about. Let us make sure it's doing its job.\n\nCall {phone} today,\n{company}\n{website}`,
      },
    ],
    professional: [
      {
        subject: `Your Free Roof Inspection — {company}`,
        body: `Dear {first_name},\n\nFollowing the recent storm activity in {city}, we wanted to reach out to offer our professional roofing services. {company} is a licensed and insured roofing contractor specializing in {service} for homeowners in {city}, {state}.\n\nWe are pleased to offer you a complimentary roof inspection to assess the current condition of your roof. Our certified inspectors will provide a detailed report and, if any issues are found, a transparent estimate for repair.\n\nOur credentials:\n• Fully licensed and insured\n• GAF-certified contractor\n• A+ BBB rating\n• Industry-leading warranties\n\nPlease contact us at {phone} or visit {website} to schedule your appointment.\n\nProfessionally yours,\n{company}`,
      },
      {
        subject: `{company} — Professional {service} in {city}`,
        body: `Dear {first_name},\n\nThank you for your interest in quality roofing services. {company} has been providing exceptional {service} to {city} homeowners, and we would welcome the opportunity to serve you.\n\nOur process is straightforward:\n1. Complimentary roof inspection\n2. Detailed findings report with photos\n3. Transparent written estimate\n4. Expert installation with warranty\n\nWe work with all major insurance carriers and offer flexible financing options to make the process as smooth as possible.\n\nTo schedule your free consultation, please call {phone} or visit {website}.\n\nWarm regards,\n{company}`,
      },
      {
        subject: `Protect your {city} home with expert {service}`,
        body: `Dear {first_name},\n\nYour roof is one of the most important components of your home, and it deserves professional attention. {company} provides comprehensive {service} to homeowners throughout {city}, {state}.\n\nWhy choose {company}?\n• Experienced, certified roofing professionals\n• Premium materials with manufacturer warranties\n• Transparent pricing — no hidden fees\n• Complete insurance claim support\n\nWe invite you to schedule a complimentary roof assessment at your convenience.\n\nContact us:\nPhone: {phone}\nWebsite: {website}\n\nRespectfully,\n{company}`,
      },
      {
        subject: `Complimentary roof assessment for your {city} property`,
        body: `Dear {first_name},\n\nI am writing on behalf of {company} to offer you a complimentary professional roof assessment. As {city}'s trusted roofing experts, we believe every homeowner deserves to know the true condition of their roof.\n\nDuring your free assessment, our certified team will:\n• Inspect all roofing components\n• Document findings with detailed photos\n• Identify any areas of concern\n• Provide a written condition report\n\nThere is no cost or obligation associated with this service. Should you wish to proceed with any recommended work, we provide detailed estimates and work with your insurance company.\n\nPlease reach out at {phone} or {website} to schedule.\n\nBest regards,\n{company}`,
      },
      {
        subject: `Expert {service} — serving {city}, {state}`,
        body: `Dear {first_name},\n\nAt {company}, we understand that choosing a roofing contractor is an important decision. That's why we're committed to earning your trust through quality workmanship and transparent communication.\n\nWe specialize in {service} and serve homeowners throughout {city} and the surrounding {state} area.\n\nSchedule your free estimate today:\n📞 {phone}\n🌐 {website}\n\nWe look forward to the opportunity to serve you.\n\nSincerely,\n{company}`,
      },
    ],
    friendly: [
      {
        subject: `Hey {first_name}! Free roof checkup from {company}`,
        body: `Hi {first_name}!\n\nHope you're doing great! I'm reaching out from {company} — we're a local roofing company here in {city}, and we'd love to offer you a free roof checkup.\n\nNo strings attached — we'll come out, take a look, and let you know how your roof is doing. If everything looks good, we'll give you a thumbs up and be on our way!\n\nIf we do find anything, we'll walk you through your options and even help with insurance if needed.\n\nJust give us a call at {phone} or check us out at {website}.\n\nHope to hear from you!\n{company} Team`,
      },
      {
        subject: `Your neighbors love us — and you will too! 🏠`,
        body: `Hi {first_name}!\n\nWe're {company}, and we've been helping homeowners in {city} with all their roofing needs. From quick repairs to full replacements, we make the process easy and stress-free.\n\nHere's what makes us different:\n• We treat every home like our own\n• Honest assessments — no upselling\n• We handle the insurance headaches\n• Friendly crew that cleans up after themselves!\n\nWant a free roof checkup? Call {phone} or visit {website}.\n\nCheers,\n{company}`,
      },
      {
        subject: `Quick question about your roof, {first_name}`,
        body: `Hey {first_name},\n\nQuick question: when's the last time you had your roof inspected?\n\nIf it's been a while (or never — no judgment!), we'd love to swing by and take a look. {company} offers totally free inspections for {city} homeowners.\n\nWe'll be honest about what we find — if your roof is fine, we'll tell you. If it needs work, we'll explain your options clearly.\n\nGive us a shout: {phone}\nOr visit: {website}\n\nTalk soon!\n{company}`,
      },
      {
        subject: `Making roofing easy for {city} homeowners`,
        body: `Hi {first_name},\n\nRoofing doesn't have to be stressful! At {company}, we make the whole process simple:\n\n1. We come out and inspect (free!)\n2. We explain what we find (in plain English!)\n3. We fix it right (and clean up after ourselves!)\n\nWe're proud to serve the {city} community and would love to help you too.\n\nReach out anytime:\n{phone} | {website}\n\nAll the best,\n{company}`,
      },
      {
        subject: `{company} here — just checking in! 👋`,
        body: `Hey {first_name}!\n\nJust a friendly note from {company}. We're your neighborhood roofing crew here in {city}, and we wanted to let you know we're around if you ever need us.\n\nWhether it's a storm repair, a leak, or just a routine checkup, we've got you covered (literally!).\n\nFeel free to reach out anytime:\n📞 {phone}\n🌐 {website}\n\nHave a great day!\nThe {company} Team`,
      },
    ],
    seasonal: [
      {
        subject: `{season} roof prep — free inspection from {company}`,
        body: `Dear {first_name},\n\nAs {season} approaches, it's the perfect time to make sure your roof is in top shape. {company} is offering free seasonal roof inspections to {city} homeowners.\n\n{season} weather can take a toll on your roof, and early detection of any issues can save you significant money in the long run.\n\nSchedule your free {season} inspection:\n{phone} | {website}\n\nBest,\n{company}`,
      },
      {
        subject: `Is your roof ready for {season}? Free checkup inside`,
        body: `Hi {first_name},\n\n{season} is right around the corner, and your roof is your home's first line of defense against the elements. {company} wants to make sure you're prepared.\n\nWe're offering complimentary {season} roof checkups in {city}. Our team will:\n• Check for loose or damaged shingles\n• Inspect flashing and seals\n• Clear debris from gutters\n• Identify potential weak points\n\nBook your free appointment: {phone}\nLearn more: {website}\n\nStay ahead of the weather!\n{company}`,
      },
      {
        subject: `{season} special: Roofing deals from {company}`,
        body: `Dear {first_name},\n\n{company} is running our {season} roofing special for {city} homeowners! This is the best time of year for {service}, and we're offering competitive seasonal pricing.\n\nWhy {season} is ideal for roofing:\n• Optimal weather conditions\n• Faster scheduling availability\n• Seasonal material pricing\n• Get ahead of storm season\n\nDon't miss out — call {phone} for a free estimate.\n{website}\n\nBest regards,\n{company}`,
      },
      {
        subject: `{season} home maintenance tip from {company}`,
        body: `Hi {first_name},\n\nHere's a {season} maintenance tip from your friends at {company}: schedule a professional roof inspection before the season kicks into high gear.\n\n{season} in {city} can bring unpredictable weather, and a small issue now can become a costly repair later. We offer free inspections and honest recommendations.\n\nCall us: {phone}\nVisit: {website}\n\nHere's to a great {season}!\n{company}`,
      },
      {
        subject: `{company}'s {season} roofing guide for {city} homeowners`,
        body: `Dear {first_name},\n\nAs {season} settles in over {city}, here's what every homeowner should know about their roof:\n\n1. Schedule an inspection — small issues compound quickly\n2. Check your attic for signs of leaks or poor ventilation\n3. Clean gutters and downspouts\n4. Trim overhanging branches\n\n{company} offers free professional inspections to help you cross #1 off the list. We specialize in {service} and serve all of {city}, {state}.\n\n{phone} | {website}\n\nWarm regards,\n{company}`,
      },
    ],
  },

  // ========================================================================
  // BLOG OUTLINES
  // ========================================================================
  blog_outline: {
    urgent: [
      {
        title: `{city} Storm Damage: What Homeowners Need to Know Right Now`,
        sections: [
          `Introduction — Overview of the {storm_date} storm and {hail_size}" hail impact`,
          `Signs of Hail Damage You Can See from the Ground`,
          `Hidden Damage: What You Can't See Can Hurt You`,
          `Why Timing Matters: Insurance Claim Deadlines`,
          `How {company} Can Help — Free Inspections and Insurance Support`,
          `Call to Action: Schedule Your Free Inspection Today`,
        ],
      },
      {
        title: `After the Storm: A Step-by-Step Guide for {city} Homeowners`,
        sections: [
          `Introduction — The {storm_date} storm by the numbers`,
          `Step 1: Assess Visible Damage Safely`,
          `Step 2: Document Everything for Insurance`,
          `Step 3: Call a Professional Roofer (Not a Storm Chaser)`,
          `Step 4: Understanding Your Insurance Claim`,
          `Step 5: Choosing the Right Contractor for Repairs`,
          `Conclusion: Why {company} Is {city}'s Trusted Choice`,
        ],
      },
      {
        title: `{hail_size}" Hail Hit {city} — Here's Why You Shouldn't Wait to Act`,
        sections: [
          `What {hail_size}" hail does to a roof`,
          `Common types of storm damage in {city}`,
          `The danger of delaying repairs`,
          `Insurance deadlines homeowners often miss`,
          `How {company} handles storm damage from inspection to completion`,
        ],
      },
      {
        title: `Storm Chasers vs Local Roofers: How to Protect Yourself in {city}`,
        sections: [
          `Introduction: The storm chaser problem after severe weather`,
          `Red flags: How to spot a disreputable contractor`,
          `What to look for in a legitimate roofing company`,
          `Why choosing local matters for {city} homeowners`,
          `{company}: Your trusted local roofing partner`,
        ],
      },
      {
        title: `Emergency Roof Repair in {city}: What to Do When Damage Can't Wait`,
        sections: [
          `When roof damage is an emergency vs. when it can wait`,
          `Temporary measures to protect your home`,
          `How to file an emergency insurance claim`,
          `What professional emergency repair looks like`,
          `{company}'s rapid response process for {city} homeowners`,
        ],
      },
    ],
    professional: [
      {
        title: `The Complete Guide to {service} in {city}, {state}`,
        sections: [
          `Introduction: Why {service} matters for your home`,
          `Types of Roofing Materials: Pros, Cons, and Costs`,
          `How to Choose the Right Contractor in {city}`,
          `Understanding Roofing Warranties`,
          `The {service} Process: What to Expect Step by Step`,
          `Financing Options for {city} Homeowners`,
          `Conclusion: Protecting Your Investment with {company}`,
        ],
      },
      {
        title: `Understanding Roof Insurance Claims: A {city} Homeowner's Guide`,
        sections: [
          `Introduction: Navigating the claims process`,
          `When to File a Roof Insurance Claim`,
          `Documentation Best Practices`,
          `Working with Your Adjuster: Tips and Common Pitfalls`,
          `How a Professional Roofing Contractor Can Help`,
          `{company}'s Insurance Claim Support Process`,
        ],
      },
      {
        title: `Top 5 Roofing Mistakes {city} Homeowners Make`,
        sections: [
          `Mistake 1: Ignoring minor damage`,
          `Mistake 2: Choosing the cheapest contractor`,
          `Mistake 3: Not checking credentials and insurance`,
          `Mistake 4: Skipping the inspection after a storm`,
          `Mistake 5: Not understanding their warranty`,
          `How {company} helps homeowners avoid these pitfalls`,
        ],
      },
      {
        title: `Roof Maintenance 101: Protecting Your {city} Home Year-Round`,
        sections: [
          `Why regular roof maintenance matters`,
          `Seasonal maintenance checklist`,
          `Signs your roof needs professional attention`,
          `The cost of neglect: repair vs. replacement`,
          `{company}'s maintenance programs for {city} homeowners`,
        ],
      },
      {
        title: `How to Choose the Best Roofing Contractor in {city}, {state}`,
        sections: [
          `Introduction: The importance of choosing right`,
          `Credentials to look for: licenses, insurance, certifications`,
          `Questions every homeowner should ask`,
          `Red flags to watch out for`,
          `Getting and comparing estimates`,
          `Why {city} homeowners trust {company}`,
        ],
      },
    ],
    friendly: [
      {
        title: `Roof Talk: Everything {city} Homeowners Should Know (But Probably Don't!)`,
        sections: [
          `Introduction: Let's talk about your roof!`,
          `Fun facts about roofs that'll surprise you`,
          `Signs your roof is trying to tell you something`,
          `DIY vs. calling a pro: when to do what`,
          `How {company} makes roofing painless in {city}`,
          `Wrapping up: Your roof FAQ answered`,
        ],
      },
      {
        title: `Your Roof and You: A {city} Homeowner's Friendly Guide`,
        sections: [
          `Hey {city}! Let's chat about your roof`,
          `How long should your roof last? (It depends!)`,
          `5 easy things you can do to extend your roof's life`,
          `When it's time for a new roof: signs to watch for`,
          `Making it easy with {company}`,
        ],
      },
      {
        title: `Don't Panic! What to Do When You Find a Roof Leak in {city}`,
        sections: [
          `First things first: don't panic!`,
          `Quick fixes to minimize damage right now`,
          `Why leaks happen (it's not always what you think)`,
          `When to call a professional`,
          `How {company} handles leak repairs — quick, clean, and done right`,
        ],
      },
      {
        title: `Behind the Scenes: What Actually Happens During a Roof Replacement`,
        sections: [
          `Introduction: Roof replacement sounds scary — but it doesn't have to be!`,
          `Day-by-day breakdown of a typical replacement`,
          `What to expect as a homeowner (noise, mess, timeline)`,
          `Tips to prep your home before the crew arrives`,
          `The {company} difference: our process in {city}`,
        ],
      },
      {
        title: `{city}'s Ultimate Roof Care Cheat Sheet`,
        sections: [
          `Welcome to the easiest roof care guide ever`,
          `Spring checklist: what to look for after winter`,
          `Summer: the best time for these roof tasks`,
          `Fall prep: getting ready for what's ahead`,
          `Winter: keep an eye on these things`,
          `When in doubt, call {company}!`,
        ],
      },
    ],
    seasonal: [
      {
        title: `{season} Roofing Guide: Preparing Your {city} Home for What's Ahead`,
        sections: [
          `Introduction: What {season} means for your roof in {city}`,
          `Top {season} roofing concerns for {state} homeowners`,
          `{season} maintenance checklist`,
          `Is {season} a good time for {service}?`,
          `How to schedule your free {season} inspection with {company}`,
        ],
      },
      {
        title: `Why {season} Is the Best Time for {service} in {city}`,
        sections: [
          `Introduction: Timing matters for roofing projects`,
          `Weather conditions: why {season} works`,
          `Contractor availability and scheduling`,
          `Cost considerations during {season}`,
          `How to get started with {company}`,
        ],
      },
      {
        title: `{season} Storm Prep: Is Your {city} Roof Ready?`,
        sections: [
          `{season} weather patterns in {city}, {state}`,
          `How storms affect different roofing materials`,
          `Pre-{season} inspection checklist`,
          `Quick fixes you can do before storm season`,
          `{company}'s {season} preparedness program`,
        ],
      },
      {
        title: `The {season} Homeowner's Guide to Roof Health in {city}`,
        sections: [
          `Why {season} is critical for roof maintenance`,
          `Common {season} roof problems in {city}`,
          `Prevention tips that save money`,
          `When to call a professional`,
          `{company}: Your {season} roofing partner in {city}`,
        ],
      },
      {
        title: `{city} {season} Home Improvement: Start with Your Roof`,
        sections: [
          `Introduction: {season} is project season!`,
          `Why your roof should be priority #1`,
          `Popular {season} roofing upgrades`,
          `Budgeting for {season} roof work`,
          `Getting a free estimate from {company}`,
        ],
      },
    ],
  },

  // ========================================================================
  // AD COPY
  // ========================================================================
  ad_copy: {
    urgent: [
      {
        headline: `Storm Damage in {city}? Free Roof Inspection`,
        description: `{hail_size}" hail hit {city} on {storm_date}. Your roof may be damaged. {company} offers free inspections and handles insurance claims. Call {phone} now — don't wait for leaks!`,
      },
      {
        headline: `{city} Hail Damage — Act Now Before Deadlines`,
        description: `Insurance claim deadlines are approaching for {city} homeowners affected by the {storm_date} storm. {company} provides free inspections and full claim support. {phone}`,
      },
      {
        headline: `⚠️ {city} Roofs at Risk After {storm_date} Storm`,
        description: `{hail_size}" hail damages roofs fast. Get a FREE professional inspection from {company}. We work with your insurance company. Licensed & insured. Call {phone}.`,
      },
      {
        headline: `Don't Wait — Free Storm Damage Inspection in {city}`,
        description: `The {storm_date} hailstorm left hidden roof damage across {city}. {company} is booking free inspections now. Insurance claim help included. {phone} | {website}`,
      },
      {
        headline: `{city} Storm Alert: Is Your Roof Safe?`,
        description: `After {hail_size}" hail on {storm_date}, many {city} roofs need repair. {company} — free inspections, insurance experts, trusted local roofer. Call {phone} today.`,
      },
      {
        headline: `Hail Damage? {company} Has You Covered`,
        description: `{city} homeowners: {hail_size}" hail can crack shingles and void warranties. Get your free inspection from {company} before damage spreads. {phone}`,
      },
    ],
    professional: [
      {
        headline: `{company} — Trusted {service} in {city}`,
        description: `Licensed, insured, and GAF-certified. {company} provides expert {service} for {city}, {state} homeowners. Free estimates and industry-leading warranties. {phone}`,
      },
      {
        headline: `Professional Roof Inspections — {city}, {state}`,
        description: `{company} offers complimentary roof inspections for {city} homeowners. Detailed assessments, transparent estimates, and quality workmanship guaranteed. {phone}`,
      },
      {
        headline: `Quality {service} for {city} Homeowners`,
        description: `{company} delivers premium roofing solutions with certified craftsmanship. Free estimates, insurance claim support, and financing available. Call {phone}.`,
      },
      {
        headline: `{city}'s #1 Rated Roofing Contractor`,
        description: `{company} — professional {service} backed by 5-star reviews and manufacturer warranties. Serving {city}, {state}. Free consultation: {phone}`,
      },
      {
        headline: `Expert Roof Repair & Replacement — {city}`,
        description: `Trust {company} for all your roofing needs. Licensed professionals, premium materials, transparent pricing. Serving {city} and surrounding {state} areas. {phone}`,
      },
    ],
    friendly: [
      {
        headline: `Need a Roofer in {city}? We'd Love to Help!`,
        description: `{company} makes roofing easy! Free inspections, honest advice, and top-notch service for {city} homeowners. No pressure — just great roofing. Call {phone}!`,
      },
      {
        headline: `{city}'s Friendliest Roofing Company 🏠`,
        description: `Meet {company}! We treat every {city} home like our own. Free roof checkups, honest recommendations, and a crew that cleans up. {phone} | {website}`,
      },
      {
        headline: `Hey {city}! Free Roof Checkup from {company}`,
        description: `Your roof works hard for you — let us make sure it's in great shape! {company} offers free, no-pressure inspections for {city} homeowners. Call {phone}!`,
      },
      {
        headline: `Roof Worries? {company} to the Rescue!`,
        description: `Whether it's a leak, storm damage, or time for an upgrade — {company} has {city} covered. Free estimates, friendly service. {phone} | {website}`,
      },
      {
        headline: `Your {city} Neighbors Trust {company}`,
        description: `Join hundreds of happy homeowners! {company} provides reliable {service} in {city} with a smile. Free inspection — call {phone} today!`,
      },
    ],
    seasonal: [
      {
        headline: `{season} Roofing Special — {city} Homeowners`,
        description: `{company} is offering seasonal pricing on {service} in {city}. {season} is the ideal time to protect your home. Free estimates — call {phone}!`,
      },
      {
        headline: `Is Your Roof Ready for {season}? Free Check!`,
        description: `{season} weather can be tough on roofs. {company} offers free {season} inspections for {city} homeowners. Don't wait — schedule today! {phone}`,
      },
      {
        headline: `{season} Roof Deals in {city} — Limited Time`,
        description: `Take advantage of {company}'s {season} pricing on {service}. Serving {city}, {state} with quality workmanship and warranties. {phone} | {website}`,
      },
      {
        headline: `Prepare Your {city} Home for {season}`,
        description: `Start with your roof! {company} provides free seasonal inspections and expert {service} for {city} homeowners. Book now: {phone}`,
      },
      {
        headline: `{season} Is Prime Roofing Season in {city}`,
        description: `Best weather, best pricing, best results. {company} offers {service} with seasonal discounts for {city} residents. Free estimate: {phone}`,
      },
      {
        headline: `{company}'s {season} Roofing Event — {city}`,
        description: `Free inspections and special {season} pricing on {service}. {city}'s trusted local roofer since day one. Call {phone} or visit {website}.`,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a single piece of content from a random matching template.
 * @param {'social_post'|'door_hanger'|'email_template'|'blog_outline'|'ad_copy'} type
 * @param {'professional'|'friendly'|'urgent'|'seasonal'} tone
 * @param {Record<string, string>} variables
 * @returns {{ type, tone, content: string|object }}
 */
export function generateContent(type, tone, variables = {}) {
  const vars = { season: currentSeason(), ...variables };
  const pool = templates[type]?.[tone];
  if (!pool || pool.length === 0) {
    throw new Error(`No templates found for type="${type}" tone="${tone}"`);
  }
  const tpl = pick(pool);

  // Some templates are strings, others are objects (door hangers, emails, etc.)
  if (typeof tpl === 'string') {
    return { type, tone, content: fillTemplate(tpl, vars) };
  }

  // Deep-fill every string value in the object
  const filled = {};
  for (const [k, v] of Object.entries(tpl)) {
    if (typeof v === 'string') {
      filled[k] = fillTemplate(v, vars);
    } else if (Array.isArray(v)) {
      filled[k] = v.map((item) => (typeof item === 'string' ? fillTemplate(item, vars) : item));
    } else {
      filled[k] = v;
    }
  }
  return { type, tone, content: filled };
}

/**
 * Return all templates for a given type/tone (for UI preview / selection).
 */
export function getTemplates(type, tone) {
  const pool = templates[type]?.[tone];
  if (!pool) return [];
  return pool;
}

/**
 * Generate N pieces of content (batch mode).
 */
export function generateContentBatch(type, tone, variables = {}, count = 5) {
  const results = [];
  const vars = { season: currentSeason(), ...variables };
  const pool = templates[type]?.[tone];
  if (!pool || pool.length === 0) {
    throw new Error(`No templates found for type="${type}" tone="${tone}"`);
  }

  // Shuffle pool and take up to `count` unique templates
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  for (const tpl of selected) {
    if (typeof tpl === 'string') {
      results.push({ type, tone, content: fillTemplate(tpl, vars) });
    } else {
      const filled = {};
      for (const [k, v] of Object.entries(tpl)) {
        if (typeof v === 'string') {
          filled[k] = fillTemplate(v, vars);
        } else if (Array.isArray(v)) {
          filled[k] = v.map((item) => (typeof item === 'string' ? fillTemplate(item, vars) : item));
        } else {
          filled[k] = v;
        }
      }
      results.push({ type, tone, content: filled });
    }
  }

  return results;
}

/** Available content types and tones for the frontend */
export const CONTENT_TYPES = ['social_post', 'door_hanger', 'email_template', 'blog_outline', 'ad_copy'];
export const TONES = ['professional', 'friendly', 'urgent', 'seasonal'];
