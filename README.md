# Product Requirements Document (PRD): Secured Direct Eligibility Calculator

## 1. Executive Summary
The **Secured Direct Eligibility Calculator** is a dynamic web application designed to evaluate a prospective borrower’s eligibility for Home Loans (HL) and Loans Against Property (LAP). By systematically analyzing user inputs related to their credit profile, employment/income, and property details, the tool assesses financial viability and applies strict underwriting knockout rules. It outputs a definitive tier (grading), an eligible loan amount, and a dynamically generated administrative checklist. 

---

## 2. Target Audience & Use Case
- **Primary Users:** Loan Officers, Sales Agents, and Direct Service Agents (DSAs) assessing leads in real-time.
- **Secondary Users:** End consumers pre-qualifying for mortgage products.
- **Key Pain Point Solved:** Standardizing underwriting guidelines into an instantaneous decision engine rather than relying on manual, error-prone spreadsheet calculations.

---

## 3. Product Architecture & User Journey
The user experience is split sequentially into 5 logical sections. Navigation is strictly gated; users cannot proceed without answering mandatory questions.

### Section 1: Eligibility & Scoring (Profile & Credit)
- **Age Input:** Applicant's exact age (minimum 21 years; >65 years implies retirement age scrutiny).
- **Property Hazards:** Checks for red-flag property types (e.g., Heavy Industry, Demolition List, Near Rail/Drainage, Chawl, Heritage). Selection of any hazard triggers an immediate rejection.
- **Bureau Score:** Categorized inputs (Above 750, 650-750, Below 650, No Hit, Don't Know).
- **Customer Profile Classification:**
  - **Negative Profiles:** Immediate rejection (e.g., Police, Politician, Astrologer, Gambling, Bar).
  - **Caution Profiles:** Triggers a follow-up ("Satisfactory prior repayment track record of 25% of proposed EMI in last 2 years?"). (e.g., Lawyers, Beauty Parlors, Taxi Operators).
  - **Standard Profiles:** "None of the above".

### Section 2: Profession & Income (Financial Assessment)
- **Income Type Selection:**
  1. **Bank Salaried:** Requires Net Monthly Salary, Average Fixed Bonus, Monthly Rental. Vintage follow-up (<2 yrs / >=2 yrs).
  2. **Cash Salaried:** Requires Applicant and Co-applicant declared cash salary. Vintage follow-up (<5 yrs / >=5 yrs).
  3. **Self-Employed (Normal):** Requires Annual EBITDA and Annual Rental. Vintage follow-up (<3 yrs / >=3 yrs).
  4. **Subjective Cash Flow:** Requires Assessed Net Monthly Cash Flow.
  5. **Milk Dairy:** Requires monthly income from milk sales. Cattle count follow-up (<10 / >=10).
- **Existing EMI Obligations:** Direct integer input to calculate net disposable income.

### Section 3: Property Assessment (Collateral & Location)
- **State Selection:** Maharashtra (MH), Madhya Pradesh (MP), Andhra Pradesh / Telangana (AP/TS).
- **City Selection:** Dependent on the State.
- **Property Category:** Dynamically populates based on State and City (e.g., Gram Panchayat, Standard Property, Patta, GramKantham).
- **Dynamic Follow-up Matrix:** Depending on the selected property category, specific verification questions are triggered (e.g., Gram Panchayat requires NA plot and Gram Sabha resolution; GramKantham requires complete construction and 13-year tax links).

### Section 4: Transaction & Loan Details
- **Market Value (MV) & Cost of Purchase (COP):** Financial baseline of the property.
- **Nature of Transaction:** Resale, Direct from Builder, Self-Construction, Plot+Construction, Balance Transfer, Top-up, etc.
- **Loan Type:** Home Loan (HL) or Loan Against Property (LAP).
- **Requested Loan Amount & Tenure:** Subject to systemic caps.

### Section 5: Evaluation & Dynamic Checklist
- Displays **Final Eligibility Amount** (the lowest of Income Eligibility, Property Eligibility, Regulatory Caps, and User Requested Amount).
- Displays the **Calculated Profile Tier** (Platinum, Gold, Silver, Standard, Below Standard).
- Displays inline warning reasons if rejected.
- Generates a **Dynamic Checklist** based on:
  - Property State (e.g., AP/TS requires Tahsildar valuation).
  - Property Type / Income Type / Loan Type.

---

## 4. Business Logic & Underwriting Rules

### 4.1. The Scoring Engine
A background score system computes a value that assigns a Final Tier.
- **Tenure:** >= 180 months (+10 pts), >= 120 months (+5 pts).
- **Bureau Score:** Above 750 (+15 pts), 650-750 (+10 pts), No Hit (+5 pts). Below 650 triggers a warning.
- **Profile:** Caution Profile (+5 pts), Standard Profile (+20 pts).
- **Income Details:** Bank Salaried (+25 pts), SE Normal (+20 pts), Subjective Cash (+10 pts), Cash Salaried/Milk Dairy (+5 pts).
- **Property Tier:** Tier 1 Standard (+30 pts), Tier 2 Gram Panchayat/Gunthewari (+10 pts), Tier 3 Unapproved (+5 pts).

**Tier Assignment Logic:**
- **Tier 4 (Rejected):** Assigned immediately if any knockout condition is met.
- **Tier 1:** Score >= 80
- **Tier 2:** Score >= 50 and < 80
- **Tier 3:** Score < 50

### 4.2. Income Calculation Formulas
1. **Bank Salaried:** `Base_Salary + (Bonus * 0.5) + min(Rental_Income, Base_Salary * 0.5)`
2. **Self-Employed (Normal):** [(Annual_EBITDA + min(Annual_Rental_Income, Annual_EBITDA * 0.5)) / 12](file:///Users/lovloothra/Downloads/Eligibility%20Calculator%20-%20Secured%20Direct/js/app.js#62-79)
3. **Subjective Cash Flow:** `Direct_Assessed_Monthly_Input`
4. **Cash Salaried:** `min(Applicant_Cash, 20,000) + min(CoApplicant_Cash, 20,000)`. Max total capped at 40,000.
5. **Milk Dairy:** `Direct_Monthly_Sales_Input`

### 4.3. FOIR (Fixed Obligation to Income Ratio)
*Amount of income that can be utilized for EMI (after deducting existing EMIs).*
- **SE Normal:** 100% (FOIR = 1.0)
- **SE Subjective:** 60% (FOIR = 0.6)
- **Bank / Cash / Milk:**
  - If Eligible Income <= ₹35,000: FOIR = 50%
  - If Eligible Income <= ₹70,000: FOIR = 60%
  - If Eligible Income > ₹70,000: FOIR = 70%

### 4.4. Amount Eligibility Calculations
`Income Eligible Amount = Present Value of Annuity (Net_Available_EMI, Assumed_ROI of 14%, Loan_Tenure)`
`Property Eligible Amount = Property_Base_Value * Base_LTV`
- **Base Value:** For HL Builder/Resale, `Base Value = min(Market Value, Cost of Purchase)`. Otherwise, `Market Value`.

### 4.5. LTV (Loan-To-Value) Matrix
- **LAP:** Base LTV = 70%
- **Home Loan (HL):**
  - If BaseValue * 89% <= ₹30 Lakhs: Base LTV = 89%
  - If BaseValue * 80% <= ₹75 Lakhs: Base LTV = 80%
  - Else: Base LTV = 75%
- **Exceptions:**
  - Single Deed Properties: Base LTV reduced by 10%.
  - Patta - Drone/Tahsildar: Base LTV strictly capped at 50%.
  - GramKantham Properties: Base LTV strictly capped at 40%.

### 4.6. Tenure & Age Caps
- Maximum global tenure: 180 Months (15 years).
- Unapproved/Patta properties capped at: 120 Months (10 years).
- GramKantham properties capped at: 120 Months (10 years).
- **Retirement Rule:** Max maturity age is 60 years for Salaried (Bank/Cash), and 65 years for Self-Employed. Loan tenure cannot exceed [(Max Age - Current Age) * 12 months](file:///Users/lovloothra/Downloads/Eligibility%20Calculator%20-%20Secured%20Direct/js/app.js#62-79).

### 4.7. Absolute Value Caps
- Global maximum loan amount is ₹50 Lakhs.
- Exceptions: Unapproved Properties, Patta Properties, and R-Zone properties are capped at ₹30 Lakhs.
- GramKantham properties are capped at ₹20 Lakhs.
- Minimum possible loan size is ₹5 Lakhs.

---

## 5. Technical Requirements
- **Frontend Framework:** Vanilla JS + HTML5 + CSS3 (TailwindCSS for rapid mobile-responsive styling).
- **Internationalization (i18n):** Data dictionary model containing 1-to-1 key mappings for English, Hindi, Telugu, and Marathi. Language toggle dynamically refreshes DOM text elements without page reload.
- **State Management:** Runtime monolithic JSON state object (`stateData`) accumulating scores, rejection triggers, and calculated amounts.
- **Deployment Strategy:** Stateless architecture (No backend database required). Easily deployable via Netlify, GitHub Pages, or Vercel.

---

## 6. Known Constraints & Future Extensions
- **ROI Hardcoding:** The system currently assumes a hardcoded 14% ROI for generating the Income Eligible principal. In future iterations, this should be configurable or dynamically fetched.
- **API Integrations:** No current integrations with live Bureau APIs or Identity verification systems. Integration with Equifax or CIBIL via backend proxy would greatly enhance accurate pre-approvals.
- **Analytics:** Needs a lightweight analytics layer (e.g. Google Analytics or Posthog event triggers) upon final loan assessment to track drop-off zones across the 5 form sections.
