/**
 * app.js — Main application logic for the Eligibility & Checklist Builder.
 *
 * Bug fixes applied:
 *  1. showStep2() → references 'progressBar' instead of non-existent 'stepProgress'
 *  2. val() → adds select[name] fallback for dynamically-generated selects
 *  3. Hazard i18n keys → uses APP_CONFIG.hazardI18nMap instead of truncated substring
 *  4. generateChecklist() → resets all block visibility before re-generating
 *  5. handleProfileChange() → defined (was missing, causing console errors)
 *  6. Removed dead doc_obli reference from checklist generation
 *  7. maxCap in evaluateLogic() aligned with calculateEligibility() logic
 *  8. Progress bar width class fix (removed duplicate w-1/3)
 */

/* ── Aliases for CONFIG ──────────────────────────────────────────── */
const { negativeProfiles, cautionProfiles, tier1Properties, tier2Properties, tier3Properties,
        cities, propCategories, transOptions, hazardI18nMap } = window.APP_CONFIG;

/* ── Application state ───────────────────────────────────────────── */
let stateData = {
    score: 0,
    summaryParts: [],
    pendingVerifications: [],
    deviations: [],
    infoNotes: [],
    rejectReasons: [],
    tierKey: '',
    actionKey: '',
    incEligible: 0,
    propEligible: 0,
    finalEligible: 0
};

/* ── Cached DOM refs ─────────────────────────────────────────────── */
const sections = [
    document.getElementById('section1'),
    document.getElementById('section2'),
    document.getElementById('section3')
];

/* ── Utility helpers ─────────────────────────────────────────────── */

function getTranslation(key) {
    const lang = document.getElementById('langSelector').value;
    const dict = window.i18n[lang] || window.i18n['en'];
    return dict[key] || window.i18n['en'][key] || key;
}

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

function formatCurrencyInput(input) {
    let rawValue = input.value.replace(/[^0-9]/g, '');
    if (rawValue) {
        input.value = parseInt(rawValue, 10).toLocaleString('en-IN');
    } else {
        input.value = '';
    }
}

/**
 * Universal value getter — works for selects (by id), text/range inputs (by id),
 * radio groups (by name), AND dynamically-generated selects (by name).
 *
 * Bug fix #2: Added select[name] fallback so Gunthewari year and AP deed-age
 * selects (which use name= not id=) are properly read.
 */
const val = (nameOrId) => {
    const el = document.getElementById(nameOrId);
    if (el && el.tagName === 'SELECT') return el.value;
    if (el && el.tagName === 'INPUT' && (el.type === 'number' || el.type === 'text' || el.type === 'range')) return el.value;
    // Fallback: dynamically generated <select> elements with name attribute
    const selByName = document.querySelector(`select[name="${nameOrId}"]`);
    if (selByName) return selByName.value;
    const checked = document.querySelector(`input[name="${nameOrId}"]:checked`);
    return checked ? checked.value : null;
};

const getNumVal = (id) => {
    const v = val(id);
    if (!v) return 0;
    return parseFloat(v.toString().replace(/,/g, '')) || 0;
};

const toggle = (id, show) => {
    const el = document.getElementById(id);
    if (el) show ? el.classList.remove('hidden-section') : el.classList.add('hidden-section');
};

const toggleWarn = (id, show) => toggle(id, show);

/**
 * Shared helper to compute tenure cap values.
 * Used by both evaluateTenure() and changeLanguage() warning text.
 */
function computeTenureCap() {
    const age = parseInt(val('q_age')) || 30;
    const inc = val('q_income') || '';
    const loanType = val('doc_loan_type') || 'hl';
    const trans = val('doc_trans') || '';

    let maturityAge = (inc === 'bank' || inc === 'cash') ? 60 : 65;
    let ageMaxMonths = (maturityAge - age) * 12;

    let prodMaxMonths = 240;
    if (loanType === 'hl') {
        prodMaxMonths = (inc === 'bank' || inc === 'cash') ? 360 : 240;
    } else if (loanType === 'lap') {
        prodMaxMonths = 180;
    }
    if (trans === 'hl_impr') {
        prodMaxMonths = 84;
    }

    // GramKantham override: strict 120-month cap
    const cat = val('prop_category');
    if (cat === 'cat_gk') {
        prodMaxMonths = Math.min(prodMaxMonths, 120);
    }

    const finalCap = Math.max(0, Math.min(ageMaxMonths, prodMaxMonths));
    return { maturityAge, ageMaxMonths, finalCap };
}

/**
 * Shared helper to compute max loan cap for a given property category/city/loan type.
 * Used by both evaluateLogic() inline warnings and calculateEligibility().
 */
function computeMaxCap() {
    const cat = val('prop_category');
    const city = val('prop_city');
    const loanType = val('doc_loan_type');

    let maxCap = 5000000;
    if (cat === 'cat_rzone' && (city === 'Pune' || city === 'Nagpur')) maxCap = 10000000;
    if (cat === 'cat_np') maxCap = 2000000;
    if (cat === 'cat_single' && loanType === 'lap') maxCap = 2500000;
    // GramKantham override: strict ₹20 Lakh cap
    if (cat === 'cat_gk') maxCap = 2000000;
    return maxCap;
}

/* ── UI display helpers ──────────────────────────────────────────── */

function updateAgeDisplay() {
    const valStr = document.getElementById('q_age').value;
    document.getElementById('ageDisplay').innerText = getTranslation('age_slider_lbl').replace('{V}', valStr);
}

/* ── Language ─────────────────────────────────────────────────────── */

function changeLanguage() {
    const lang = document.getElementById('langSelector').value;
    const dict = window.i18n[lang] || window.i18n['en'];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            if (el.tagName === 'INPUT' && el.type === 'placeholder') { el.placeholder = dict[key]; }
            else { el.innerHTML = dict[key]; }
        } else if (window.i18n['en'][key]) {
            el.innerHTML = window.i18n['en'][key];
        }
    });

    updateAgeDisplay();

    if (!document.getElementById('evalContainer').classList.contains('hidden-section')) {
        const profileSummary = document.getElementById('profileSummary');
        if (profileSummary && stateData.summaryParts.length > 0) {
            profileSummary.innerText = stateData.summaryParts.map(k => getTranslation(k)).join(", ");
        } else if (profileSummary) {
            profileSummary.innerText = getTranslation('sum_incomplete');
        }

        const wList = document.getElementById('evalWarningsList');
        if (wList && stateData.rejectReasons.length > 0) {
            wList.innerHTML = stateData.rejectReasons.map(k => {
                let txt = getTranslation(k);
                if (k === 'warn_tenure_capped') {
                    const { finalCap, maturityAge } = computeTenureCap();
                    txt = txt.replace('{X}', finalCap).replace('{Y}', maturityAge);
                }
                return `<li>${txt}</li>`;
            }).join('');
        }

        document.getElementById('evalTierBadge').innerText = getTranslation(stateData.tierKey);
        document.getElementById('evalActionText').innerText = getTranslation(stateData.actionKey);

        document.getElementById('valIncElig').innerText = formatCurrency(stateData.incEligible);
        document.getElementById('valPropElig').innerText = formatCurrency(stateData.propEligible);
        document.getElementById('valFinalElig').innerText = formatCurrency(stateData.finalEligible);
    }

    if (!document.getElementById('checklistContainer').classList.contains('hidden-section')) {
        generateChecklist();
    }
}

/* ── Navigation ──────────────────────────────────────────────────── */

function nextSection(num) {
    if (num === 2 && (!val('q_bureau') || !val('q_profile'))) return alert("Please answer all questions before proceeding.");
    if (num === 3 && (!val('q_income') || !val('emi_val'))) return alert("Please answer all questions before proceeding.");

    sections.forEach((s, idx) => {
        if (idx === num - 1) s.classList.remove('hidden-section');
        else s.classList.add('hidden-section');
    });

    // Bug fix #8: removed duplicate w-1/3 class; use clean dynamic width
    const widthClass = num === 1 ? 'w-1/3' : num === 2 ? 'w-2/3' : 'w-full';
    document.getElementById('progressBar').className =
        `absolute top-1/2 left-0 h-1 bg-blue-600 -z-10 transform -translate-y-1/2 transition-all duration-500 ${widthClass}`;
    document.getElementById('navStep1').className = 'flex flex-col items-center bg-slate-50 px-2';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevSection(num) {
    sections.forEach((s, idx) => {
        if (idx === num - 1) s.classList.remove('hidden-section');
        else s.classList.add('hidden-section');
    });
    const widthClass = num === 1 ? 'w-1/3' : num === 2 ? 'w-2/3' : 'w-full';
    document.getElementById('progressBar').className =
        `absolute top-1/2 left-0 h-1 bg-blue-600 -z-10 transform -translate-y-1/2 transition-all duration-500 ${widthClass}`;
        
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Tenure evaluation ───────────────────────────────────────────── */

function evaluateTenure() {
    const { maturityAge, ageMaxMonths, finalCap } = computeTenureCap();

    const tenureInput = document.getElementById('loan_tenure');
    if (!tenureInput) return;

    let currentVal = parseInt(tenureInput.value);
    const warnEl = document.getElementById('warn_tenure_cap');

    if (ageMaxMonths <= 0) {
        warnEl.innerText = '⚠️ ' + getTranslation('warn_tenure_retire');
        warnEl.classList.remove('hidden-section');
        if (currentVal > 0) tenureInput.value = 0;
    } else if (currentVal > finalCap) {
        tenureInput.value = finalCap;
        let msg = getTranslation('warn_tenure_capped').replace('{X}', finalCap).replace('{Y}', maturityAge);
        warnEl.innerText = '⚠️ ' + msg;
        warnEl.classList.remove('hidden-section');
    } else {
        warnEl.classList.add('hidden-section');
    }
}

/* ── Income type handler ─────────────────────────────────────────── */

function handleIncomeChange() {
    const inc = val('q_income');
    toggle('inc_bank_follow', inc === 'bank');
    toggle('inc_se_follow', inc === 'se_norm');
    toggle('inc_cash_follow', inc === 'cash');
    toggle('inc_milk_follow', inc === 'milk');

    toggle('inc_vals_bank', inc === 'bank');
    toggle('inc_vals_se_norm', inc === 'se_norm');
    toggle('inc_vals_cash', inc === 'cash');
    toggle('inc_vals_se_sub', inc === 'se_sub');
    toggle('inc_vals_milk', inc === 'milk');

    evaluateLogic();
    evaluateTenure();
}

/* ── Profile change handler (Bug fix #5: was missing) ────────────── */

function handleProfileChange() {
    evaluateLogic();
}

/* ── Core inline validation logic ────────────────────────────────── */

function evaluateLogic() {
    const profileVal = val('q_profile') || '';
    const isNegative = negativeProfiles.includes(profileVal);
    const isCaution = cautionProfiles.includes(profileVal);

    toggle('profile_followup_container', isCaution);
    if (!isCaution) document.querySelectorAll('input[name="profile_track"]').forEach(r => r.checked = false);

    const isFSI = val('prop_fsi') === 'yes';
    toggle('fsi_followups', isFSI);
    const st = val('prop_state');
    toggle('fsi_g2_container', isFSI && (st === 'mh' || st === 'mp'));

    const age = parseInt(val('q_age')) || 30;
    toggleWarn('warn_age_18_20', age >= 18 && age <= 20);
    toggleWarn('warn_age_65_plus', age > 65);

    toggleWarn('warn_q3', val('q_bureau') === 'below650');
    toggleWarn('warn_q_profile_neg', isNegative);
    toggleWarn('warn_profile_track', val('profile_track') === 'no');

    toggleWarn('warn_q6_bank', val('inc_bank_vint') === '<2');
    toggleWarn('warn_q6_se_norm', val('inc_se_vint') === '<3');
    toggleWarn('warn_q6_cash1', val('inc_cash_vint') === '<5');
    
    // Warn if Milk Dairy is selected out and other income is missing
    const isMilk = val('q_income') === 'milk';
    toggleWarn('warn_milk_other', isMilk && getNumVal('inc_milk_other') === 0 && (val('inc_milk_other') !== '' || getNumVal('inc_milk_sales') > 0));
    toggleWarn('warn_inc_milk', val('inc_milk_catt') === '<10');

    const lAmt = getNumVal('loan_amt');
    toggleWarn('warn_loan_min', val('loan_amt') && lAmt < 500000);

    // Bug fix #7: use shared computeMaxCap() so inline warning matches calculation logic
    const maxLoan = computeMaxCap();
    toggleWarn('warn_loan_max', val('loan_amt') && lAmt > maxLoan);

    toggleWarn('warn_cat', val('prop_category') === 'cat_patta_gp');
    toggleWarn('warn_hazards', val('prop_hazards')?.startsWith('rej_'));

    toggleWarn('warn_fup_rz_mc', val('fup_rz_mc') === 'no');
    toggleWarn('warn_fup_rz_g2', val('fup_rz_g2') === 'no');

    const gYr = val('fup_gunt_yr');
    toggleWarn('warn_gunt_yr_1', gYr === '09_15');
    toggleWarn('warn_gunt_yr_2', gYr === 'p15');

    toggleWarn('warn_fup_un_deed', val('fup_un_deed') === 'no');
    toggleWarn('warn_fup_un_age', val('fup_un_age') === 'no');
    toggleWarn('warn_fup_un_zone', val('fup_un_zone') === 'no');

    toggleWarn('warn_fup_gp_age', val('fup_gp_age') === 'no');
    toggleWarn('warn_fup_gp_g2', val('fup_gp_g2') === 'no');

    toggleWarn('warn_fup_pat_age', val('fup_pat_age') === 'no');
    toggleWarn('warn_fup_pat_size', val('fup_pat_size') === 'no');

    toggleWarn('warn_fup_np_tax', val('fup_np_tax') === 'no');
    toggleWarn('warn_fup_np_age', val('fup_np_age') === 'no');

    toggleWarn('warn_fup_nota_mc', val('fup_nota_mc') === 'no');

    const apDeed = val('fup_ap_deed');
    toggleWarn('warn_ap_deed_1', apDeed === 'lt12');
    toggleWarn('warn_ap_deed_2', apDeed === '12_3');

    toggleWarn('warn_fup_add_next', val('fup_add_next') === 'no');
    toggleWarn('warn_fup_add_age', val('fup_add_age') === 'no');

    toggleWarn('warn_fsi_age', val('fsi_age') === 'no');
    toggleWarn('warn_fsi_g2', val('fsi_g2') === 'no');

    // GramKantham follow-up warnings
    toggleWarn('warn_fup_gk_road', val('fup_gk_road') === 'no');
    toggleWarn('warn_fup_gk_ec', val('fup_gk_ec') === 'no');

    // GramKantham cross-validation: auto-correct loan amount & tenure if over caps
    const cat = val('prop_category');
    if (cat === 'cat_gk') {
        const loanInput = document.getElementById('loan_amt');
        const tenureInput = document.getElementById('loan_tenure');
        if (loanInput && getNumVal('loan_amt') > 2000000) {
            loanInput.value = '20,00,000';
            toggleWarn('warn_gk_loan_cap_inline', true);
        } else {
            toggleWarn('warn_gk_loan_cap_inline', false);
        }
        if (tenureInput && parseInt(tenureInput.value) > 120) {
            tenureInput.value = '120';
            toggleWarn('warn_gk_tenure_cap_inline', true);
        } else {
            toggleWarn('warn_gk_tenure_cap_inline', false);
        }
    }
}

/* ── State / city / property handlers ────────────────────────────── */

function handleStateChange() {
    const st = val('prop_state');
    stateData.propState = st;
    const citySel = document.getElementById('prop_city');

    citySel.innerHTML = `<option value="" disabled selected data-i18n="select_option">${getTranslation('select_option')}</option>`;
    document.getElementById('prop_followups').innerHTML = '';

    if (st === 'mh' || st === 'mp') {
        cities[st].forEach(c => citySel.innerHTML += `<option value="${c}" data-i18n="${c}">${getTranslation(c)}</option>`);
        toggle('city_container', true);
        toggle('cat_container', false);
    } else if (st === 'ap_ts') {
        toggle('city_container', false);
        populatePropertyCategories();
    } else {
        toggle('city_container', false);
        toggle('cat_container', false);
    }

    evaluateLogic();
}

function populatePropertyCategories() {
    const st = val('prop_state');
    const city = val('prop_city');
    const catSel = document.getElementById('prop_category');

    catSel.innerHTML = `<option value="" disabled selected data-i18n="select_option">${getTranslation('select_option')}</option>`;

    let opts = [...propCategories[st]];

    if (st === 'mh' && city === 'Nagpur') opts.splice(4, 0, { v: 'cat_unapp', t: 'Unapproved Layout' });
    if (st === 'mp' && (city === 'Indore' || city === 'Bhopal')) opts.splice(3, 0, { v: 'cat_nota', t: 'Notarized Sale Deed' });

    opts.forEach(o => catSel.innerHTML += `<option value="${o.v}" data-i18n="${o.v}">${getTranslation(o.v)}</option>`);

    toggle('cat_container', true);
    document.getElementById('prop_followups').innerHTML = '';
    changeLanguage();
    evaluateLogic();
}

function handleCategoryChange() {
    const cat = val('prop_category');
    stateData.propCat = cat;
    const container = document.getElementById('prop_followups');
    container.innerHTML = '';
    let html = '';

    const createQ = (name, lblKey) => `
        <div class="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <label class="block text-sm font-medium mb-2" data-i18n="${lblKey}">${getTranslation(lblKey)}</label>
            <div class="flex gap-4">
                <label class="cursor-pointer relative"><input type="radio" name="${name}" value="yes" class="peer sr-only" onchange="evaluateLogic()"><div class="p-2 border border-blue-200 bg-white rounded-lg text-center text-sm font-medium peer-checked:bg-blue-500 peer-checked:text-white transition-all px-4" data-i18n="opt_yes">${getTranslation('opt_yes')}</div></label>
                <label class="cursor-pointer relative"><input type="radio" name="${name}" value="no" class="peer sr-only" onchange="evaluateLogic()"><div class="p-2 border border-blue-200 bg-white rounded-lg text-center text-sm font-medium peer-checked:bg-blue-500 peer-checked:text-white transition-all px-4" data-i18n="opt_no">${getTranslation('opt_no')}</div></label>
            </div>
            <p id="warn_${name}" class="text-red-600 text-xs mt-2 hidden-section font-medium flex items-start"><span class="mr-1">⚠️</span> <span data-i18n="inline_warning">${getTranslation('inline_warning')}</span></p>
        </div>`;

    if (cat === 'cat_rzone') {
        html += createQ('fup_rz_mc', 'fup_rz_mc_lbl');
        html += createQ('fup_rz_g2', 'fup_rz_g2_lbl');
    } else if (cat === 'cat_gunthewari') {
        html += `
        <div class="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <label class="block text-sm font-medium mb-2" data-i18n="fup_gunt_yr_lbl">${getTranslation('fup_gunt_yr_lbl')}</label>
            <select name="fup_gunt_yr" class="w-full p-2 rounded border border-blue-200 outline-none bg-white" onchange="evaluateLogic()"><option value="" disabled selected data-i18n="select_option">${getTranslation('select_option')}</option><option value="t08" data-i18n="t08">${getTranslation('t08')}</option><option value="09_15" data-i18n="09_15">${getTranslation('09_15')}</option><option value="p15" data-i18n="p15">${getTranslation('p15')}</option></select>
            <p id="warn_gunt_yr_1" class="text-red-600 text-xs mt-2 hidden-section font-medium flex items-start"><span class="mr-1">⚠️</span> <span data-i18n="inline_warning">${getTranslation('inline_warning')}</span></p>
            <p id="warn_gunt_yr_2" class="text-red-600 text-xs mt-2 hidden-section font-medium flex items-start"><span class="mr-1">⚠️</span> <span data-i18n="inline_warning">${getTranslation('inline_warning')}</span></p>
        </div>`;
    } else if (cat === 'cat_unapp') {
        html += createQ('fup_un_deed', 'fup_un_deed_lbl');
        html += createQ('fup_un_age', 'fup_un_age_lbl');
        html += createQ('fup_un_zone', 'fup_un_zone_lbl');
    } else if (cat === 'cat_gp' || cat === 'cat_gaothan') {
        html += createQ('fup_gp_age', 'fup_gp_age_lbl');
        html += createQ('fup_gp_g2', 'fup_gp_g2_lbl');
    } else if (cat === 'cat_patta_dt') {
        html += createQ('fup_pat_age', 'fup_pat_age_lbl');
        html += createQ('fup_pat_size', 'fup_pat_size_lbl');
    } else if (cat === 'cat_np') {
        html += createQ('fup_np_tax', 'fup_np_tax_lbl');
        html += createQ('fup_np_age', 'fup_np_age_lbl');
    } else if (cat === 'cat_nota') {
        html += createQ('fup_nota_mc', 'fup_nota_mc_lbl');
    } else if (cat === 'cat_single') {
        html += `
        <div class="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <label class="block text-sm font-medium mb-2" data-i18n="fup_ap_deed_lbl">${getTranslation('fup_ap_deed_lbl')}</label>
            <select name="fup_ap_deed" class="w-full p-2 rounded border border-blue-200 outline-none bg-white" onchange="evaluateLogic()"><option value="" disabled selected data-i18n="select_option">${getTranslation('select_option')}</option><option value="lt12" data-i18n="lt12">${getTranslation('lt12')}</option><option value="12_3" data-i18n="12_3">${getTranslation('12_3')}</option><option value="gt3" data-i18n="gt3">${getTranslation('gt3')}</option></select>
            <p id="warn_ap_deed_1" class="text-red-600 text-xs mt-2 hidden-section font-medium flex items-start"><span class="mr-1">⚠️</span> <span data-i18n="inline_warning">${getTranslation('inline_warning')}</span></p>
            <p id="warn_ap_deed_2" class="text-red-600 text-xs mt-2 hidden-section font-medium flex items-start"><span class="mr-1">⚠️</span> <span data-i18n="inline_warning">${getTranslation('inline_warning')}</span></p>
        </div>`;
    } else if (cat === 'cat_add_floor') {
        html += createQ('fup_add_next', 'fup_add_next_lbl');
        html += createQ('fup_add_age', 'fup_add_age_lbl');
    } else if (cat === 'cat_gk') {
        html += createQ('fup_gk_road', 'fup_gk_road_lbl');
        html += createQ('fup_gk_ec', 'fup_gk_ec_lbl');
    }

    container.innerHTML = html;
    evaluateLogic();
}

function handleFSIChange() {
    const isFSI = val('prop_fsi') === 'yes';
    toggle('fsi_followups', isFSI);
    const st = val('prop_state');
    toggle('fsi_g2_container', isFSI && (st === 'mh' || st === 'mp'));
    evaluateLogic();
}

/* ── Eligibility calculation & scoring ───────────────────────────── */

function calculateEligibility() {
    evaluateTenure();

    if (!val('prop_state') || !val('prop_category') || !val('prop_hazards') || !val('prop_fsi') || !val('loan_amt') || !val('loan_tenure')) {
        alert("Please answer all questions before proceeding."); return;
    }

    stateData.score = 0;
    stateData.summaryParts = [];
    stateData.pendingVerifications = [];
    stateData.deviations = [];
    stateData.infoNotes = [];
    stateData.rejectReasons = [];
    let isRejected = false;

    const incType = val('q_income');
    const age = parseInt(val('q_age')) || 30;
    if (age < 21) stateData.rejectReasons.push("rej_age_min");

    let maturityAge = (incType === 'bank' || incType === 'cash') ? 60 : 65;
    let ageMaxMonths = (maturityAge - age) * 12;
    if (ageMaxMonths <= 0) stateData.rejectReasons.push("rej_retire_age");

    const finalTenure = parseInt(val('loan_tenure')) || 0;
    if (finalTenure >= 180) stateData.score += 10;
    else if (finalTenure >= 120) stateData.score += 5;

    const bur = val('q_bureau');
    if (bur === 'above750') { stateData.score += 15; stateData.summaryParts.push("sum_high_bureau"); }
    if (bur === '650_750') { stateData.score += 10; stateData.summaryParts.push("sum_med_bureau"); }
    if (bur === 'nohit') { stateData.score += 5; stateData.summaryParts.push("sum_no_bureau"); }
    if (bur === 'below650') { stateData.summaryParts.push("sum_low_bureau"); stateData.rejectReasons.push("warn_bur_below"); }
    if (bur === 'dk') stateData.pendingVerifications.push("pen_bur_dk");

    const prof = val('q_profile');
    if (negativeProfiles.includes(prof)) stateData.rejectReasons.push("rej_neg_prof");
    else if (cautionProfiles.includes(prof)) {
        stateData.score += 5;
        if (val('profile_track') === 'no') stateData.rejectReasons.push("rej_caut_no_track");
    } else if (prof === 'none') {
        stateData.score += 20;
    }

    let eligible_inc = 0;

    if (incType === 'bank') {
        if (val('inc_bank_vint') === '<2') stateData.rejectReasons.push("rej_bank_vint");
        else { stateData.score += 25; stateData.summaryParts.push("sum_bank_salaried"); }
        const sal = getNumVal('inc_bank_sal');
        const bon = getNumVal('inc_bank_bon');
        const rent = getNumVal('inc_bank_rent');
        const cappedRent = Math.min(rent, sal * 0.5);
        eligible_inc = sal + (bon * 0.5) + cappedRent;
    } else if (incType === 'se_norm') {
        if (val('inc_se_vint') === '<3') stateData.rejectReasons.push("rej_se_vint");
        else { stateData.score += 20; stateData.summaryParts.push("sum_self_emp"); }
        const ebitda = getNumVal('inc_se_ebitda');
        const rent = getNumVal('inc_se_rent');
        const cappedRent = Math.min(rent, ebitda * 0.5);
        eligible_inc = (ebitda + cappedRent) / 12;
    } else if (incType === 'se_sub') {
        stateData.score += 10; stateData.summaryParts.push("sum_sub_cash");
        eligible_inc = getNumVal('inc_sub_cf');
    } else if (incType === 'cash') {
        if (val('inc_cash_vint') === '<5') stateData.rejectReasons.push("rej_cash_vint");
        else { stateData.score += 5; stateData.summaryParts.push("sum_cash_salaried"); }
        const c1 = getNumVal('inc_cash_1');
        const c2 = getNumVal('inc_cash_2');
        const cap1 = Math.min(c1, 20000);
        const cap2 = Math.min(c2, 20000);
        eligible_inc = Math.min(cap1 + cap2, 40000);
    } else if (incType === 'milk') {
        if (val('inc_milk_catt') === '<10') stateData.rejectReasons.push("rej_milk_catt");
        else { stateData.score += 5; stateData.summaryParts.push("sum_milk_dairy"); }
        eligible_inc = getNumVal('inc_milk_sales') + getNumVal('inc_milk_other');
    }

    const cat = val('prop_category');
    if (tier1Properties.includes(cat)) { stateData.score += 30; stateData.summaryParts.unshift("sum_std_prop"); }
    else if (tier2Properties.includes(cat)) { stateData.score += 10; stateData.summaryParts.unshift("sum_gp_prop"); }
    else if (tier3Properties.includes(cat)) { stateData.score += 5; stateData.summaryParts.unshift("sum_unapp_prop"); }

    if (cat === 'cat_patta_gp') stateData.rejectReasons.push("warn_patta_gp");

    if (cat === 'cat_rzone') {
        if (val('fup_rz_mc') === 'no') stateData.rejectReasons.push("warn_rz_mc");
        if (val('fup_rz_g2') === 'no') stateData.rejectReasons.push("warn_rz_g2");
    }
    if (cat === 'cat_gunthewari') {
        const gYr = val('fup_gunt_yr');
        if (gYr === '09_15') stateData.rejectReasons.push("warn_gunt_yr_1");
        if (gYr === 'p15') stateData.rejectReasons.push("warn_gunt_yr_2");
    }
    if (cat === 'cat_unapp') {
        if (val('fup_un_deed') === 'no') stateData.rejectReasons.push("warn_un_deed");
        if (val('fup_un_age') === 'no') stateData.rejectReasons.push("warn_un_age");
        if (val('fup_un_zone') === 'no') stateData.rejectReasons.push("warn_un_zone");
    }
    if (cat === 'cat_gp' || cat === 'cat_gaothan') {
        if (val('fup_gp_age') === 'no') stateData.rejectReasons.push("warn_gp_age");
        if (val('fup_gp_g2') === 'no') stateData.rejectReasons.push("warn_gp_g2");
    }
    if (cat === 'cat_patta_dt') {
        if (val('fup_pat_age') === 'no') stateData.rejectReasons.push("warn_pat_age");
        if (val('fup_pat_size') === 'no') stateData.rejectReasons.push("warn_pat_size");
    }
    if (cat === 'cat_np') {
        if (val('fup_np_tax') === 'no') stateData.rejectReasons.push("warn_np_tax");
        if (val('fup_np_age') === 'no') stateData.rejectReasons.push("warn_np_age");
    }
    if (cat === 'cat_nota') {
        if (val('fup_nota_mc') === 'no') stateData.rejectReasons.push("warn_nota_mc");
    }
    if (cat === 'cat_single') {
        const d = val('fup_ap_deed');
        if (d === 'lt12') stateData.rejectReasons.push("warn_ap_deed_1");
        if (d === '12_3') stateData.rejectReasons.push("warn_ap_deed_2");
    }
    if (cat === 'cat_add_floor') {
        if (val('fup_add_next') === 'no') stateData.rejectReasons.push("warn_add_next");
        if (val('fup_add_age') === 'no') stateData.rejectReasons.push("warn_add_age");
    }
    if (cat === 'cat_gk') {
        if (val('fup_gk_road') === 'no') stateData.rejectReasons.push("warn_gk_road");
        if (val('fup_gk_ec') === 'no') stateData.rejectReasons.push("warn_gk_ec");
        if (val('doc_loan_type') === 'hl') stateData.rejectReasons.push("warn_gk_hl");
        const gkTrans = val('doc_trans');
        if (gkTrans === 'hl_self' || gkTrans === 'hl_plot') stateData.rejectReasons.push("warn_gk_construction");
    }

    if (val('prop_fsi') === 'yes') {
        if (val('fsi_age') === 'no') stateData.rejectReasons.push("warn_fsi_age");
        if ((val('prop_state') === 'mh' || val('prop_state') === 'mp') && val('fsi_g2') === 'no') {
            stateData.rejectReasons.push("warn_fsi_g2");
        }
    }

    // Bug fix #3: Use explicit hazard→i18n mapping instead of truncated substring
    const haz = val('prop_hazards');
    if (haz && haz.startsWith('rej_')) {
        const hazKey = hazardI18nMap[haz];
        if (hazKey) {
            stateData.rejectReasons.push(hazKey);
        }
    }

    // FINANCIAL CALCULATIONS
    let emi = getNumVal('emi_val');
    const trans = val('doc_trans');
    let triggerBtAssumption = false;
    
    if (emi > 0 && (trans === 'hl_bt' || trans === 'lap_bt' || trans === 'lap_topup')) {
        emi = 0;
        triggerBtAssumption = true;
    }
    
    toggle('evalAssumptionContainer', triggerBtAssumption);

    const reqAmt = getNumVal('loan_amt');

    let foir = 0.60;
    if (incType === 'bank' || incType === 'cash' || incType === 'milk') {
        if (eligible_inc <= 35000) foir = 0.50;
        else if (eligible_inc <= 70000) foir = 0.60;
        else foir = 0.70;
    } else if (incType === 'se_norm') {
        foir = 1.00;
    } else if (incType === 'se_sub') {
        foir = 0.60;
    }

    const availEmi = (eligible_inc * foir) - emi;
    let incomeEligibleAmt = 0;
    if (availEmi > 0 && finalTenure > 0) {
        const r = 0.14 / 12; // 14% assumed ROI
        const n = finalTenure;
        incomeEligibleAmt = availEmi * ((Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)));
    }

    const mv = getNumVal('doc_mv');
    const cop = getNumVal('doc_cop');
    let baseVal = mv;
    // `trans` is already defined above
    if (trans === 'hl_builder' || trans === 'hl_resale') {
        if (cop > 0) baseVal = Math.min(mv, cop);
    }

    let baseLtv = 0.70;
    const loanType = val('doc_loan_type');
    if (loanType === 'hl') {
        if (baseVal * 0.89 <= 3000000) baseLtv = 0.89;
        else if (baseVal * 0.80 <= 7500000) baseLtv = 0.80;
        else baseLtv = 0.75;
    } else if (loanType === 'lap') {
        baseLtv = 0.70;
    }

    if (cat === 'cat_single') baseLtv -= 0.10;
    if (cat === 'cat_patta_dt') baseLtv = Math.min(baseLtv, 0.50);
    // GramKantham override: strict 40% LTV
    if (cat === 'cat_gk') baseLtv = 0.40;

    const propEligibleAmt = baseVal * baseLtv;
    const maxCap = computeMaxCap();

    let finalEligible = Math.min(incomeEligibleAmt, propEligibleAmt, reqAmt, maxCap);
    finalEligible = Math.max(0, finalEligible);

    stateData.incEligible = incomeEligibleAmt;
    stateData.propEligible = propEligibleAmt;
    stateData.finalEligible = finalEligible;

    if (reqAmt < 500000) stateData.rejectReasons.push("warn_loan_min");
    if (finalEligible < 500000 && reqAmt >= 500000) stateData.rejectReasons.push("warn_loan_min");
    if (reqAmt > maxCap) stateData.rejectReasons.push("warn_loan_max");

    if (stateData.rejectReasons.length > 0) isRejected = true;

    renderEvalCard(isRejected);
}

/* ── Evaluation card rendering ───────────────────────────────────── */

function renderEvalCard(isRejected) {
    sections.forEach(s => s.classList.add('hidden-section'));
    toggle('evalContainer', true);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const bar = document.getElementById('evalScoreBar');
    const txt = document.getElementById('evalScoreText');
    const badge = document.getElementById('evalTierBadge');

    let s = stateData.score;

    txt.innerText = `${s} / 100`;

    if (isRejected) {
        stateData.tierKey = 'tier_4';
        stateData.actionKey = 'action_4';
        badge.className = "ml-auto text-xs py-1 px-3 rounded-full font-bold uppercase shadow-sm bg-red-500 text-white";
        bar.className = "h-3 rounded-full transition-all duration-1000 ease-out bg-red-500";

        toggle('evalWarningsContainer', true);
        toggle('btnProceedStep2', false);
    } else {
        toggle('evalWarningsContainer', false);
        toggle('btnProceedStep2', true);

        if (s >= 80) {
            stateData.tierKey = 'tier_1';
            stateData.actionKey = 'action_1';
            badge.className = "ml-auto text-xs py-1 px-3 rounded-full font-bold uppercase shadow-sm bg-green-500 text-white";
            bar.className = "h-3 rounded-full transition-all duration-1000 ease-out bg-green-500";
        } else if (s >= 50) {
            stateData.tierKey = 'tier_2';
            stateData.actionKey = 'action_2';
            badge.className = "ml-auto text-xs py-1 px-3 rounded-full font-bold uppercase shadow-sm bg-blue-500 text-white";
            bar.className = "h-3 rounded-full transition-all duration-1000 ease-out bg-blue-400";
        } else {
            stateData.tierKey = 'tier_3';
            stateData.actionKey = 'action_3';
            badge.className = "ml-auto text-xs py-1 px-3 rounded-full font-bold uppercase shadow-sm bg-orange-500 text-white";
            bar.className = "h-3 rounded-full transition-all duration-1000 ease-out bg-orange-400";
        }
    }

    setTimeout(() => { bar.style.width = `${s}%`; }, 100);
    changeLanguage();
}

/* ── Phase 2 event handlers ──────────────────────────────────────── */

/**
 * Bug fix #1: References 'progressBar' instead of non-existent 'stepProgress'.
 */
function showStep2() {
    toggle('evalContainer', false);
    toggle('phase2Container', true);

    document.getElementById('progressBar').style.width = '100%';
    document.getElementById('navStep2Icon').className = 'w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center mb-1';
    document.getElementById('navStep2Text').className = 'text-xs font-bold text-blue-800';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBackToPhase1() {
    toggle('phase2Container', false);
    toggle('evalContainer', true);

    document.getElementById('progressBar').style.width = ''; 
    document.getElementById('navStep2Icon').className = 'w-8 h-8 rounded-full bg-slate-300 text-slate-600 font-bold flex items-center justify-center mb-1';
    document.getElementById('navStep2Text').className = 'text-xs font-bold text-slate-600';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleLoanTypeChange() {
    const lt = val('doc_loan_type');
    const tSel = document.getElementById('doc_trans');
    tSel.innerHTML = `<option value="" disabled selected data-i18n="select_option">${getTranslation('select_option')}</option>`;
    if (lt) {
        transOptions[lt].forEach(o => tSel.innerHTML += `<option value="${o.v}" data-i18n="${o.k}">${getTranslation(o.k)}</option>`);
        toggle('trans_container', true);
    }

    // GramKantham cross-validation: Home Loan not allowed
    const isGK = stateData.propCat === 'cat_gk';
    toggleWarn('warn_gk_hl', isGK && lt === 'hl');

    changeLanguage();
    handleTransChange();
    evaluateTenure();
}

function handleTransChange() {
    const tr = val('doc_trans');
    toggle('cop_container', tr === 'hl_builder' || tr === 'hl_resale');
    toggle('const_cost_container', tr === 'hl_self' || tr === 'hl_plot' || tr === 'hl_impr');

    // GramKantham cross-validation: construction-type transactions not allowed
    const isGK = stateData.propCat === 'cat_gk';
    const isConstruction = tr === 'hl_self' || tr === 'hl_plot';
    toggleWarn('warn_gk_construction', isGK && isConstruction);

    evaluateTenure();
}

function handleRentedChange() {
    toggle('rented_followup', val('doc_rented') === 'yes');
}

/* ── Checklist generation ────────────────────────────────────────── */

function generateChecklist() {
    const cnst = val('doc_const');
    if (!cnst || !val('doc_loan_type') || !val('doc_trans') || !val('doc_rented')) {
        alert("Please complete Section 4 administrative questions."); return;
    }

    const errDiv = document.getElementById('chk_errors');
    if (cnst === 'rej_huf') {
        errDiv.setAttribute('data-i18n', 'err_huf');
        errDiv.innerText = getTranslation('err_huf');
        toggle('chk_errors', true);
        toggle('chk_content', false);
    } else {
        toggle('chk_errors', false);
        toggle('chk_content', true);
    }

    toggle('phase2Container', false);
    toggle('checklistContainer', true);
    toggle('progressContainer', false);

    // Populate print-only summary
    document.getElementById('printFinalElig').innerText = formatCurrency(stateData.finalEligible);
    document.getElementById('printProfileSummary').innerText = stateData.summaryParts.length > 0 ? 
        stateData.summaryParts.map(k => getTranslation(k)).join(", ") : getTranslation('sum_incomplete');
    
    const printTier = document.getElementById('printTier');
    printTier.innerText = getTranslation(stateData.tierKey);
    printTier.className = "text-sm font-bold uppercase tracking-wider " + 
        (stateData.tierKey === 'tier_4' ? 'text-red-600' : 
         stateData.tierKey === 'tier_1' ? 'text-green-600' : 
         stateData.tierKey === 'tier_2' ? 'text-blue-600' : 'text-orange-600');

    const printWarnList = document.getElementById('printWarningsList');
    if (stateData.rejectReasons.length > 0) {
        toggle('printWarningsContainer', true);
        printWarnList.innerHTML = stateData.rejectReasons.map(k => {
            let txt = getTranslation(k);
            if (k === 'warn_tenure_capped') {
                const { finalCap, maturityAge } = computeTenureCap();
                txt = txt.replace('{X}', finalCap).replace('{Y}', maturityAge);
            }
            return `<li>${txt}</li>`;
        }).join('');
    } else {
        toggle('printWarningsContainer', false);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Bug fix #4: Reset all blocks to hidden before re-populating
    toggle('block_const', false);
    toggle('block_trans', false);
    toggle('block_prop', false);
    toggle('block_add', false);

    let base = ["doc_base_1", "doc_base_2", "doc_base_3"];
    document.getElementById('list_base').innerHTML = base.map(x => `<li data-i18n="${x}">${getTranslation(x)}</li>`).join('');

    let constDocs = [];
    if (cnst === 'part' || cnst === 'llp') constDocs = ["doc_const_1", "doc_const_2", "doc_const_3"];
    if (cnst === 'pvt' || cnst === 'opc') constDocs = ["doc_const_4", "doc_const_5", "doc_const_6", "doc_const_7", "doc_const_8"];

    if (constDocs.length > 0) {
        toggle('block_const', true);
        document.getElementById('list_const').innerHTML = constDocs.map(x => `<li data-i18n="${x}">${getTranslation(x)}</li>`).join('');
    }

    let transDocs = [];
    const tr = val('doc_trans');
    if (tr === 'hl_builder') transDocs = ["doc_trans_1", "doc_trans_2"];
    if (tr === 'hl_resale') transDocs = ["doc_trans_3", "doc_trans_4", "doc_trans_5"];
    if (tr === 'hl_bt' || tr === 'lap_bt' || tr === 'lap_topup') transDocs = ["doc_trans_6", "doc_trans_7", "doc_trans_8"];
    if (tr === 'hl_self' || tr === 'hl_impr') transDocs = ["doc_trans_9"];

    if (transDocs.length > 0) {
        toggle('block_trans', true);
        document.getElementById('list_trans').innerHTML = transDocs.map(x => `<li data-i18n="${x}">${getTranslation(x)}</li>`).join('');
    }

    let propDocs = [];
    const pc = stateData.propCat;
    if (pc === 'cat_rzone') propDocs = ["doc_prop_1", "doc_prop_2", "doc_prop_3", "doc_prop_4", "doc_prop_5"];
    if (pc === 'cat_gp' || pc === 'cat_gaothan') propDocs = ["doc_prop_6", "doc_prop_7", "doc_prop_8", "doc_prop_9"];
    if (pc === 'cat_gunthewari') propDocs = ["doc_prop_10", "doc_prop_11"];
    if (pc === 'cat_unapp') propDocs = ["doc_prop_12", "doc_prop_13", "doc_prop_14"];

    if (pc === 'cat_nota') propDocs = ["doc_prop_15", "doc_prop_16", "doc_prop_17", "doc_prop_18"];
    if (pc === 'cat_patta_dt') propDocs = ["doc_prop_19", "doc_prop_20", "doc_prop_21"];
    if (pc === 'cat_np') propDocs = ["doc_prop_22", "doc_prop_23", "doc_prop_24"];

    if (pc === 'cat_gk') propDocs = ["doc_prop_25", "doc_prop_26", "doc_prop_27"];
    if (pc === 'cat_std' || pc === 'cat_single' || pc === 'cat_add_floor') propDocs = ["doc_prop_28", "doc_prop_29"];

    if (propDocs.length === 0) propDocs = ["doc_prop_30", "doc_prop_31"];

    toggle('block_prop', true);
    document.getElementById('list_prop').innerHTML = propDocs.map(x => `<li data-i18n="${x}">${getTranslation(x)}</li>`).join('');

    let addDocs = [];
    if (val('doc_rented') === 'yes') addDocs.push("doc_add_1", "doc_add_2");
    if (val('doc_guarantor') === 'yes') addDocs.push("doc_add_3", "doc_add_4", "doc_add_5");
    // Bug fix #6: removed dead doc_obli reference (no HTML element exists for it)

    if (addDocs.length > 0) {
        toggle('block_add', true);
        document.getElementById('list_add').innerHTML = addDocs.map(x => `<li data-i18n="${x}">${getTranslation(x)}</li>`).join('');
    }
}

/* ── Reset ────────────────────────────────────────────────────────── */

function resetApp() {
    location.reload();
}

/* ── Initialize ──────────────────────────────────────────────────── */
changeLanguage();
