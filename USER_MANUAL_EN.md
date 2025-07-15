# 📋 Work Orders Management System - User Manual

## **🔍 Finding Work Orders**

### **Quick Search by W.O. Number**
1. Look for the field **"🔍 Search ID Classic"** at the top
2. Type the work order number (example: "19417")
3. Press **Enter** or wait a moment
4. The system will find the work order **even if you have thousands of records**
5. Click the **✕** button to return to normal view

### **Regular Filtering** 
- **Filter by ID Classic**: Only searches currently loaded work orders
- **Filter by Status**: PROCESSING, APPROVED, FINISHED
- **Filter by Week/Day**: Use date selectors

---

## **📊 Understanding System Modes**

### **Normal Mode** (Small Database)
- Shows all work orders at once
- Fast filtering and searching
- No page controls needed

### **Scalable Mode** (Large Database)
When you see the **📊 SCALABLE MODE** indicator:
- System loads work orders in pages for better performance
- Use **← Prev** and **Next →** buttons to navigate
- Shows total number of work orders in your database

### **Archived Work Orders**
- **Include Old W.O. (>2 years)** checkbox
- When **unchecked**: Shows only recent work orders (faster)
- When **checked**: Shows all historical work orders
- Automatically optimized for large databases

---

## **➕ Creating New Work Orders**

1. Click **"Nueva Work Order"** (New Work Order)
2. Fill in required fields:
   - **Trailer**: Select from dropdown
   - **Status**: PROCESSING, APPROVED, or FINISHED
   - **Date**: Pick date
   - **Mechanics**: Add team members
   - **Total Hours**: Enter labor time
3. **Add Parts** (if needed):
   - Search inventory by part name/number
   - Select quantity needed
   - Parts automatically deducted from inventory
4. **ID Classic**: Only required when status is FINISHED
5. Click **"Guardar Work Order"** (Save Work Order)

---

## **✏️ Editing Work Orders**

1. Find the work order (use search if needed)
2. Click **Edit** button
3. Enter **password**: `2025`
4. Make your changes
5. **Important**: ID Classic can only be set when status is FINISHED
6. Click **Save Changes**

---

## **📄 Generating Reports**

### **PDF Reports**
1. Click **"Generate PDF"** on any work order
2. PDF automatically includes:
   - Work order details
   - Parts used with costs
   - Labor hours and rates
   - Total costs
3. PDF is saved and can be reprinted anytime

### **Excel Export**
1. Click **"Exportar a Excel"** (Export to Excel)
2. Choose date range or export all
3. Includes all work order data for analysis

---

## **🔄 System Status Indicators**

### **Server Status**
- **🟢 Online**: System working normally
- **🟡 Waking up**: Server starting (wait a moment)
- **🔴 Offline**: Connection issues (click Reconnect)

### **Search Status**
- **🔍 SEARCHING**: Active search for specific work order
- Shows what you're searching for

### **Loading Indicators**
- **Loading...**: Data being fetched
- **Processing...**: Work order being saved
- Be patient during these operations

---

## **💡 Tips for Best Performance**

### **For Large Databases (1000+ Work Orders)**
1. Use **🔍 Search ID Classic** to find specific work orders quickly
2. Keep **Include Old W.O.** unchecked for daily work
3. Use date filters to narrow down results
4. Navigate pages rather than loading everything at once

### **Daily Workflow**
1. Check recent work orders (default view)
2. Use search to find specific orders
3. Create new work orders as needed
4. Generate PDFs for completed work
5. Use Excel export for monthly reports

---

## **⚠️ Important Notes**

### **ID Classic Rules**
- Can only be set when status is **FINISHED**
- Must be unique across all work orders
- Required for finished work orders
- System prevents duplicates

### **Parts Management**
- Parts are automatically deducted from inventory
- Check inventory before creating large work orders
- Receive new parts in the Inventory section

### **Password Protection**
- Editing requires password: `2025`
- Protects against accidental changes
- All edits are logged for audit trail

---

## **🔧 Troubleshooting**

### **Can't Find a Work Order**
1. Try **🔍 Search ID Classic** instead of regular filter
2. Check if **Include Old W.O.** needs to be enabled
3. Verify the work order number is correct

### **System Running Slow**
1. Use search instead of browsing all records
2. Keep **Include Old W.O.** unchecked
3. Close and reopen browser if needed
4. Check server status indicator

### **PDF Not Generating**
1. Check internet connection
2. Wait for any "Processing..." to complete
3. Try refreshing the page
4. Contact IT support if persistent

---

## **📞 Support**

For technical issues or questions:
1. Check server status indicators first
2. Try refreshing the browser
3. Verify internet connection
4. Contact system administrator

**The system is designed to handle company growth automatically - from hundreds to thousands of work orders without performance loss.**