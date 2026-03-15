/**
 * config.js — Application data constants and configuration.
 * Contains profile lists, property tier definitions, city/state data,
 * property category options, transaction options, and hazard-to-i18n mappings.
 */

window.APP_CONFIG = {
    negativeProfiles: [
        'neg_security', 'neg_laundry', 'neg_wine', 'neg_finance',
        'neg_politician', 'neg_police', 'neg_recovery', 'neg_bar',
        'neg_astrologer', 'neg_gambling'
    ],

    cautionProfiles: [
        'caut_lawyer', 'caut_worship', 'caut_scrap', 'caut_xerox',
        'caut_beauty', 'caut_taxi', 'caut_milk'
    ],

    tier1Properties: ['cat_std'],
    tier2Properties: ['cat_gp', 'cat_gaothan', 'cat_gunthewari', 'cat_gk'],
    tier3Properties: ['cat_np', 'cat_patta_dt', 'cat_nota', 'cat_rzone', 'cat_unapp', 'cat_single', 'cat_add_floor'],

    cities: {
        mh: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Kolhapur', 'Jalgaon', 'Dhule', 'Aurangabad', 'Ahmednagar', 'Amravati', 'Rest of Maharashtra'],
        mp: ['Indore', 'Bhopal', 'Dewas', 'Ujjain', 'Rest of Madhya Pradesh'],
        ap_ts: []
    },

    propCategories: {
        mh: [
            { v: 'cat_std', t: 'Standard Property (Fully Approved/Clear Title/NA)' },
            { v: 'cat_gp', t: 'Gram Panchayat' },
            { v: 'cat_gaothan', t: 'Gaothan' },
            { v: 'cat_gunthewari', t: 'Gunthewari' },
            { v: 'cat_rzone', t: 'R Zone' }
        ],
        mp: [
            { v: 'cat_std', t: 'Standard Property (Fully Approved/Clear Title/NA)' },
            { v: 'cat_np', t: 'Nagar Palika / Parishad' },
            { v: 'cat_patta_dt', t: 'Patta - Drone or Tahsildar' },
            { v: 'cat_patta_gp', t: 'Patta - Gram Panchayat (Not Funded)' }
        ],
        ap_ts: [
            { v: 'cat_std', t: 'Standard Property (Fully Approved/Clear Title/NA)' },
            { v: 'cat_gk', t: 'GramKantham' },
            { v: 'cat_single', t: 'Single Deed Properties' },
            { v: 'cat_add_floor', t: 'Additional Floor Funding (Unapproved Floor)' }
        ]
    },

    transOptions: {
        hl: [
            { v: 'hl_builder', t: 'Direct from Builder', k: 'hl_builder' },
            { v: 'hl_resale', t: 'Resale Purchase', k: 'hl_resale' },
            { v: 'hl_self', t: 'Self-Construction', k: 'hl_self' },
            { v: 'hl_plot', t: 'Plot + Construction', k: 'hl_plot' },
            { v: 'hl_impr', t: 'Home Improvement', k: 'hl_impr' },
            { v: 'hl_bt', t: 'Balance Transfer', k: 'hl_bt' }
        ],
        lap: [
            { v: 'lap_fresh', t: 'Fresh LAP', k: 'lap_fresh' },
            { v: 'lap_bt', t: 'Balance Transfer', k: 'lap_bt' },
            { v: 'lap_topup', t: 'BT + Top-up', k: 'lap_topup' }
        ]
    },

    /**
     * Maps hazard option values (e.g. "rej_Heavy Industry") to their i18n keys.
     * Bug fix: the old code truncated the value to 4 chars producing invalid keys.
     */
    hazardI18nMap: {
        'rej_Heavy Industry': 'haz_heavy',
        'rej_Situated in Malls (Excluding Ground Floor)': 'haz_mall',
        'rej_Cinema Hall / Multiplex': 'haz_cinema',
        'rej_Religious Purpose': 'haz_religion',
        'rej_Resorts, Bars, Clubs, or Banquet Halls': 'haz_resort',
        'rej_Farmhouse': 'haz_farm',
        'rej_Demolition List': 'haz_demo',
        'rej_Heritage Property': 'haz_heritage',
        'rej_Basement Property': 'haz_base',
        'rej_Chawl or Pagdi Property': 'haz_chawl',
        'rej_Landlocked Property': 'haz_landlock',
        'rej_Near Burial Grounds / Graveyards': 'haz_burial',
        'rej_Near Railway Line or Drainage': 'haz_rail',
        'rej_Buffer areas': 'haz_buffer',
        'rej_Community Dominated / Negative Area': 'haz_comm',
        'rej_NPA Property': 'haz_npa',
        'rej_Unsettled legal disputes': 'haz_dispute',
        'rej_Long-term tenant': 'haz_tenant'
    }
};
