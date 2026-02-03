export const EXPENSE_CATEGORIES = [
    {
        id: 'operational',
        label: 'تشغيلية (Operational)',
        subCategories: [
            { id: 'packaging', label: 'أكياس وتغليف (Bags & Packaging)' },
            { id: 'cleaning', label: 'مواد تنظيف (Cleaning)' },
            { id: 'transport', label: 'نقل ووقود (Transport & Fuel)' },
            { id: 'maintenance', label: 'صيانة وإصلاحات (Maintenance)' },
            { id: 'utilities', label: 'كهرباء/ماء/غاز (Utilities)' },
        ]
    },
    {
        id: 'personnel',
        label: 'الموظفين (Staff)',
        subCategories: [
            { id: 'lunch', label: 'غداء/أكل (Lunch)' },
            { id: 'daily_wage', label: 'أجرة يومية (Daily Wage)' },
            { id: 'advance', label: 'تسبيق (Avance)' },
            { id: 'bonus', label: 'مكافأة (Bonus)' },
        ]
    },
    {
        id: 'purchases',
        label: 'مشتريات سريعة (Purchases)',
        subCategories: [
            { id: 'ingredients', label: 'مكونات (بقدونس، ثوم...)' },
            { id: 'ice', label: 'ثلج (Ice)' },
            { id: 'gas_bottles', label: 'قارورات غاز' },
        ]
    },
    {
        id: 'marketing',
        label: 'تسويق (Marketing)',
        subCategories: [
            { id: 'ads', label: 'إعلانات ممولة' },
            { id: 'print', label: 'طباعة ولافتات' },
        ]
    },
    {
        id: 'other',
        label: 'أخرى (Other)',
        subCategories: [
            { id: 'misc', label: 'نثريات متنوعة' },
            { id: 'waste', label: 'تالف/خسارة' },
        ]
    }
];
