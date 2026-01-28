# 📜 מדריך סקריפטים - Scripts Guide

## סקריפטים זמינים / Available Scripts

### 🚀 הפעלת המערכת

| סקריפט | פקודה | תיאור |
|--------|-------|-------|
| **הפעלה רגילה** | `npm run dev` | מפעיל את שרת הפיתוח |
| **הפעלה + דפדפן** | `npm run dev:edge` | מפעיל את השרת ופותח דפדפן אוטומטית |
| **התחל** | `npm start` | זהה ל-dev:edge - מפעיל ופותח דפדפן |

### 🔨 בנייה ובדיקות

| סקריפט | פקודה | תיאור |
|--------|-------|-------|
| **בניית פרודקשן** | `npm run build` | בונה את הפרויקט לפרודקשן |
| **בניית פיתוח** | `npm run build:dev` | בונה במצב פיתוח |
| **בדיקת קוד** | `npm run lint` | בודק שגיאות בקוד |
| **בדיקות** | `npm test` | מריץ את כל הבדיקות |
| **בדיקות בזמן אמת** | `npm run test:watch` | מריץ בדיקות בזמן אמת |
| **תצוגה מקדימה** | `npm run preview` | מציג את הגרסה שנבנתה |

---

## 🎯 השימוש הנפוץ ביותר

רוב הזמן תשתמש ב:
```bash
npm start
```

זה יפעיל את השרת ויפתח את הדפדפן אוטומטית ל-http://localhost:8080

---

## 💻 פקודות שימושיות נוספות

### להפסיק את השרת
לחץ `Ctrl+C` בטרמינל

### לנקות ולהפעיל מחדש
```bash
npm run dev
```

### לבדוק שהכל עובד
```bash
npm test
```
