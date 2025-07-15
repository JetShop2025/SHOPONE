# User Manual - SHOPONE
## Work Orders Management System

**Version:** 2.0  
**Last Updated:** January 2025  
**System Type:** Work Order & Inventory Management

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Main Menu Navigation](#main-menu-navigation)
4. [Work Orders Module](#work-orders-module)
5. [Inventory Management](#inventory-management)
6. [Trailer Control](#trailer-control)
7. [Trailer Location](#trailer-location)
8. [Audit System](#audit-system)
9. [PDF Generation](#pdf-generation)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

---

## System Overview

The Graphical System v2 is a comprehensive work order management platform designed for fleet maintenance operations. It integrates work order creation, inventory tracking, trailer management, and audit logging into a unified system.

### Key Features
- **Work Order Management**: Complete lifecycle from creation to completion
- **Real-time Inventory**: FIFO-based inventory deduction with live tracking
- **Trailer Control**: Fleet management with rental/return capabilities
- **PDF Generation**: Automatic work order documentation
- **Multi-mechanic Support**: Track multiple mechanics per work order
- **Audit Trail**: Complete system activity logging
- **Mobile Responsive**: Works on desktop, tablet, and mobile devices

### System Architecture
- **Frontend**: React 19 with TypeScript
- **Backend**: Node.js/Express API
- **Database**: MySQL with optimized queries
- **File Storage**: PDF generation and document management

---

## Getting Started

### System Access
1. Open your web browser
2. Navigate to the system URL (provided by your administrator)
3. No login required for most functions (open access system)
4. Audit module requires password protection

### Browser Requirements
- **Recommended**: Google Chrome, Firefox, Safari, Edge
- **Minimum**: Any modern browser with JavaScript enabled
- **Mobile**: iOS Safari, Android Chrome

---

## Main Menu Navigation

The main menu provides access to all system modules:

### Available Modules
1. **INVENTORY** (Blue) - Manage parts and stock
2. **WORK ORDERS** (Green) - Create and track work orders
3. **TRAILER CONTROL** (Blue) - Manage trailer fleet
4. **TRAILER LOCATION** (Orange) - GPS tracking and locations
5. **AUDIT** (Red) - System activity logs (password protected)

### Navigation Tips
- Click any module button to enter that section
- Use browser back button to return to main menu
- Each module has its own navigation and controls

---

## Work Orders Module

The Work Orders module is the core of the system, handling all maintenance work tracking.

### Creating a New Work Order

1. **Click "New Work Order" button**
2. **Fill in basic information:**
   - **Bill To Co**: Select from dropdown (GALGRE, JETGRE, PRIGRE, etc.)
   - **Trailer**: Auto-populated based on Bill To Co selection
   - **Date**: Current date (can be modified)
   - **Mechanic**: Enter mechanic name
   - **Description**: Detailed work description

3. **Add Parts (if needed):**
   - Click "Add Part" button
   - Enter SKU (auto-completion available)
   - System will auto-fill part details from inventory
   - Specify quantity used
   - Cost is automatically populated

4. **Advanced Options:**
   - **Multiple Mechanics**: Add additional mechanics with individual hours
   - **Extra Options**: Additional services or notes
   - **Pending Parts**: Add parts awaiting delivery for specific trailers

5. **Set Status:**
   - **PROCESSING**: Work in progress
   - **APPROVED**: Work completed, awaiting final approval
   - **FINISHED**: Work completely done

6. **Save**: Click "Save" to create work order

### Editing Work Orders

1. **Select Work Order**: Click on any row in the work orders table
2. **Click "Edit" button**
3. **Modify fields** as needed
4. **ID Classic field**: Appears only in edit mode for tracking
5. **Save changes**: System will update inventory and regenerate PDF

### Work Order Features

#### Filtering and Search
- **Date Range**: Filter by specific date ranges
- **Week Filter**: View work orders by week
- **Status Filter**: Filter by PROCESSING, APPROVED, FINISHED
- **ID Classic Search**: Quick search by ID Classic number

#### Bulk Operations
- **Select Multiple**: Use checkboxes to select multiple work orders
- **Bulk Delete**: Delete multiple work orders at once
- **Export**: Export filtered results to Excel

#### Smart Features
- **Auto-completion**: Parts auto-complete from inventory
- **Pending Parts Integration**: Shows parts awaiting specific trailers
- **Inventory Deduction**: Automatic FIFO inventory reduction
- **PDF Generation**: Automatic PDF creation with invoice links

### Mechanic Hour Tracking

#### Single Mechanic Mode
- Enter mechanic name and total hours
- System calculates labor cost at $60/hour

#### Multiple Mechanics Mode
- Add multiple mechanics with individual hours
- Track regular hours and dead hours separately
- System totals all hours for labor calculation

#### Hourmeter Modal
- Click "Hourmeter" button to view detailed mechanic statistics
- Filter by week to see specific period data
- Shows total hours, work orders, and dead hours per mechanic

### Pending Parts System

#### What are Pending Parts?
Parts that have been received and assigned to specific trailers but not yet used in work orders.

#### Using Pending Parts
1. **View Available Parts**: When creating work order, system shows pending parts for selected trailer
2. **Add to Work Order**: Click "Add to WO" button next to desired parts
3. **Automatic Processing**: Parts are automatically moved from pending to used status
4. **Inventory Update**: System updates inventory counts automatically

### Status Workflow

```
PROCESSING → APPROVED → FINISHED
```

- **PROCESSING**: Default status for new work orders
- **APPROVED**: Work completed, ready for final approval
- **FINISHED**: All work complete, work order closed

---

## Inventory Management

### Inventory Overview
The inventory module manages all parts, stock levels, and receives.

### Main Inventory Table

#### Columns Displayed
- **SKU**: Part number (unique identifier)
- **BAR CODE**: Barcode for scanning
- **CATEGORY**: Part category/type
- **PART NAME**: Descriptive name
- **PROVIDER**: Supplier information
- **BRAND**: Manufacturer brand
- **U/M**: Unit of measure
- **AREA**: Storage location
- **RECEIVED**: Total quantity received
- **WO OUTPUTS**: Quantity used in work orders
- **ON HAND**: Current available stock
- **IMAGE LINK**: Product image URL
- **PRICE (USD)**: Unit cost
- **INVOICE LINK**: Link to purchase invoice

### Adding New Inventory Items

1. **Click "Add Part" button**
2. **Fill in required fields:**
   - SKU (required)
   - Part Name (required)
   - Category, Provider, Brand
   - Unit of Measure
   - Area/Location
   - Price
   - Image and Invoice links

3. **Set Initial Stock**: Enter received quantity
4. **Save**: System creates new inventory item

### Editing Inventory

1. **Select Item**: Click on inventory row
2. **Click "Edit" button**
3. **Modify fields** as needed
4. **Save changes**: Updates inventory record

### Receive Inventory Module

#### Purpose
Track incoming parts and assign them to specific trailers or general stock.

#### Receiving Process
1. **Access**: Click "Receive Inventory" button
2. **Fill Receive Form:**
   - **SKU**: Enter part number
   - **Item Description**: Part details
   - **Category**: Part type
   - **Provider/Brand**: Supplier information
   - **Destination Trailer**: Specific trailer (optional)
   - **Quantity**: Amount received
   - **Cost**: Total cost including tax
   - **Invoice Info**: Invoice number and link
   - **PO Classic**: Purchase order reference

3. **Save**: Creates receive record and updates inventory

#### Pending Parts Management
- Parts with destination trailers become "pending parts"
- Shows in work order creation for specific trailers
- Automatically used when work orders are created
- Status changes from PENDING to USED

---

## Trailer Control

### Trailer Fleet Management
Comprehensive trailer tracking and management system.

### Trailer Information Display

#### Trailer Cards Show:
- **Trailer Number**: Unique identifier
- **Status**: DISPONIBLE (Available) or RENTADO (Rented)
- **Client Assignment**: Current renter (if applicable)
- **Type/Model**: Trailer specifications
- **Location**: Current location
- **Rental Dates**: Start and end dates

### Client-Based Trailer Organization

#### Rental Clients
- AMAZON, WALMART, HOME DEPOT, FEDEX, UPS, TARGET
- Used for external rental operations

#### Regular Clients (Work Order Clients)
- GALGRE, JETGRE, PRIGRE, RAN100, GABGRE
- Used for work order assignments

#### Trailer Number Ranges
- **GALGRE**: 1-199
- **JETGRE**: 2-200-299
- **PRIGRE**: 3-300-399
- **RAN100**: 4-400-499
- **GABGRE**: 5-500-599

### Trailer Operations

#### Renting a Trailer
1. **Select Available Trailer**: Click on trailer with DISPONIBLE status
2. **Click "Rent" button**
3. **Fill Rental Form:**
   - **Client**: Select from rental clients list
   - **Rental Date**: Start date
   - **Return Date**: Expected return
   - **Notes**: Additional information
4. **Confirm**: Trailer status changes to RENTADO

#### Returning a Trailer
1. **Select Rented Trailer**: Click on trailer with RENTADO status
2. **Click "Return" button**
3. **Confirm Return**: System records return date
4. **Status Update**: Trailer becomes DISPONIBLE again

#### Viewing Rental History
1. **Click "History" button** on any trailer
2. **View Complete Record**: All rental periods and clients
3. **Filter by Date**: View specific time periods

#### Viewing Work Orders
1. **Click "W.O" button** on any trailer
2. **See All Work Orders**: Complete maintenance history
3. **Filter by Month**: View specific periods
4. **Access PDFs**: Direct links to work order documents

---

## Trailer Location

### GPS Tracking System
Real-time trailer location tracking and management.

### Features
- **Live GPS Coordinates**: Current trailer positions
- **Location History**: Track movement over time
- **Geofencing**: Set location boundaries
- **Route Optimization**: Plan efficient routes
- **Mobile Integration**: Update locations from mobile devices

### Using Location Module
1. **Access Module**: Click "TRAILER LOCATION" from main menu
2. **View Map**: See all trailer positions
3. **Select Trailer**: Click marker for details
4. **Update Location**: Manual location updates if needed
5. **Generate Reports**: Location-based reporting

---

## Audit System

### Security and Access
- **Password Protected**: Requires password "6214"
- **Administrative Access**: For authorized personnel only
- **Complete Activity Log**: All system changes tracked

### Audit Log Features

#### Information Tracked
- **User Actions**: Who performed each operation
- **Timestamps**: Exact date and time
- **Module**: Which system area was affected
- **Operation Type**: CREATE, UPDATE, DELETE operations
- **Data Changes**: Before and after values
- **Work Order Details**: Complete work order lifecycle
- **Inventory Changes**: Stock movements and adjustments
- **Trailer Operations**: Rental and return activities

#### Viewing Audit Logs
1. **Access Audit**: Click "AUDIT" from main menu
2. **Enter Password**: "6214"
3. **Browse Logs**: View chronological activity
4. **Filter Options**: Filter by date, user, or module
5. **Export Data**: Generate audit reports

### Audit Categories

#### Work Order Audits
- Work order creation with all details
- Edits and modifications
- Status changes
- Deletion records
- Part additions and removals

#### Inventory Audits
- New part additions
- Stock adjustments
- Receive records
- Inventory deductions
- Price changes

#### Trailer Audits
- Rental transactions
- Return records
- Status changes
- Location updates

---

## PDF Generation

### Automatic PDF Creation
The system automatically generates professional PDFs for all work orders.

### PDF Features

#### Document Contents
- **Header**: Company branding and work order number
- **Work Order Details**: 
  - Bill To Company
  - Trailer number
  - Date and mechanic
  - ID Classic number
  - Status
- **Description**: Complete work description
- **Parts List**: 
  - SKU and part names
  - Quantities used
  - Unit costs and totals
  - Invoice links for traceability
- **Labor Summary**:
  - Mechanic hours
  - Labor costs ($60/hour)
  - Total work order cost
- **Professional Formatting**: Clean, print-ready layout

#### PDF Access
- **Automatic Generation**: Created when work order is saved
- **Multiple Access Points**:
  - "View PDF" button in work orders table
  - Direct links in trailer work order history
  - Email distribution capabilities
- **Regeneration**: PDFs update automatically when work orders are edited

#### Invoice Integration
- **Clickable Links**: Direct links to part invoices
- **Traceability**: Complete part source documentation
- **Cost Verification**: Easy access to purchase documentation

---

## Troubleshooting

### Common Issues and Solutions

#### Server Connection Issues
**Problem**: "Server offline" or connection errors
**Solutions**:
1. Check internet connection
2. Wait for server to wake up (may take 30-60 seconds)
3. Refresh the page
4. Clear browser cache if problems persist

#### Work Order Not Saving
**Problem**: Work order creation fails
**Solutions**:
1. Verify all required fields are filled
2. Check that trailer number is valid for selected Bill To Co
3. Ensure parts have valid SKUs
4. Try again after a few seconds

#### Inventory Not Loading
**Problem**: Parts don't appear in dropdown
**Solutions**:
1. Wait for inventory to load (may take a few seconds)
2. Refresh the page
3. Check server connection status

#### PDF Not Generating
**Problem**: PDF view button doesn't work
**Solutions**:
1. Allow popups in browser settings
2. Check if work order was saved successfully
3. Try regenerating PDF by editing and saving work order

#### Auto-completion Not Working
**Problem**: Part details don't auto-fill
**Solutions**:
1. Ensure SKU exists in inventory
2. Wait for inventory data to load
3. Type complete SKU number
4. Check for typos in SKU entry

### Browser-Specific Issues

#### Chrome
- Enable popups for PDF viewing
- Clear cache if performance issues occur

#### Firefox
- Allow popups and downloads
- Check privacy settings

#### Safari
- Enable JavaScript
- Allow popups for PDF functionality

#### Mobile Browsers
- Use landscape mode for better visibility
- Tap and hold for context menus
- Enable popups for PDF viewing

---

## Best Practices

### Work Order Management

#### Creating Effective Work Orders
1. **Use Clear Descriptions**: Write detailed, specific work descriptions
2. **Accurate Part Selection**: Verify SKUs before adding parts
3. **Proper Status Updates**: Keep status current throughout work lifecycle
4. **Complete All Fields**: Fill in all relevant information
5. **Review Before Saving**: Double-check all entries

#### Inventory Best Practices
1. **Regular Stock Checks**: Monitor ON HAND quantities
2. **Accurate Receives**: Enter receive data promptly and accurately
3. **Proper SKU Management**: Use consistent SKU naming conventions
4. **Update Costs**: Keep part costs current
5. **Invoice Links**: Always include invoice links for traceability

#### Trailer Management
1. **Timely Updates**: Update trailer status immediately upon rental/return
2. **Accurate Information**: Ensure client and date information is correct
3. **Regular Monitoring**: Check trailer status regularly
4. **Maintenance Scheduling**: Use work order history for maintenance planning

### System Performance

#### Optimal Usage Tips
1. **Regular Refresh**: Refresh pages periodically for latest data
2. **Avoid Multiple Tabs**: Use single tab to prevent conflicts
3. **Save Frequently**: Save work orders promptly to avoid data loss
4. **Clean Browser Cache**: Clear cache monthly for best performance

#### Data Management
1. **Consistent Naming**: Use standardized naming conventions
2. **Regular Backups**: System performs automatic backups
3. **Data Validation**: Verify data accuracy before saving
4. **Archive Old Records**: Keep system performance optimal

### Security Guidelines
1. **Audit Access**: Protect audit password ("6214")
2. **Regular Monitoring**: Review audit logs periodically
3. **Data Privacy**: Protect sensitive customer and financial information
4. **Access Control**: Limit system access to authorized personnel

---

## Support and Maintenance

### System Updates
- **Automatic Updates**: System updates deploy automatically
- **Feature Announcements**: New features announced via system notifications
- **Maintenance Windows**: Scheduled maintenance communicated in advance

### Getting Help
1. **Documentation**: Refer to this manual first
2. **System Admin**: Contact your system administrator
3. **Technical Support**: Contact development team for technical issues
4. **Training**: Additional training available upon request

### System Monitoring
- **Performance Tracking**: System monitors its own performance
- **Error Logging**: Automatic error detection and reporting
- **Usage Analytics**: System tracks usage patterns for optimization

---

## Appendices

### Appendix A: Keyboard Shortcuts
- **Ctrl+N**: New work order (when in work orders module)
- **Ctrl+S**: Save current form
- **Ctrl+F**: Search/Filter
- **Esc**: Close modal dialogs

### Appendix B: System Limits
- **Work Orders**: No limit
- **Inventory Items**: No practical limit
- **PDF Storage**: Automatic cloud storage
- **User Sessions**: 8-hour timeout

### Appendix C: Integration Points
- **Excel Export**: Compatible with Excel 2016+
- **PDF Viewers**: Compatible with all standard PDF viewers
- **Mobile Apps**: Responsive web design works with all mobile browsers
- **Printing**: Optimized for standard 8.5x11" paper

---

*This manual covers Graphical System v2. For additional help or training, contact your system administrator.*

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Manual Type**: End User Guide
- **Work Order Management**: Complete lifecycle management from creation to completion
- **Inventory Integration**: Real-time inventory tracking with FIFO (First In, First Out) deduction
- **PDF Generation**: Automatic PDF generation for work orders with invoice links
- **Multi-mechanic Support**: Track multiple mechanics and hours per work order
- **Status Tracking**: PROCESSING → APPROVED → FINISHED workflow
- **Trailer Management**: Integration with trailer location and pending parts
- **Real-time Updates**: Smart polling system with server status monitoring
- **Audit Trail**: Complete audit log for all system operations

---

## Getting Started

### System Access
1. **Login**: Enter your username and password on the login screen
2. **Main Menu**: After login, you'll see the main menu with four primary modules:
   - **WORK ORDERS** (Green button)
   - **INVENTORY** (Blue button)
   - **TRAILER CONTROL** (Blue button)
   - **TRAILER LOCATION** (Orange button)
   - **AUDIT LOG** (Purple button)

### User Interface Elements
- **Server Status Indicator**: Located in the top-right corner of most screens
  - 🟢 **Online**: System is connected and working normally
  - 🟡 **Waking up**: Server is starting up (may take 30-60 seconds)
  - 🔴 **Offline**: Connection lost, use "Reconnect" button

---

## Work Orders Module

### Overview
The Work Orders module is the core of the system, allowing you to create, edit, and track maintenance work orders for trailers and equipment.

### Creating a New Work Order

1. **Access**: Click "WORK ORDERS" from the main menu
2. **New Work Order**: Click the blue "New Work Order" button
3. **Fill Required Information**:
   - **Bill To Co**: Select from dropdown (GALGRE, JETGRE, PRIGRE, etc.)
   - **Trailer**: Select trailer number (auto-populated based on Bill To Co)
   - **Date**: Select work date
   - **Mechanic**: Enter mechanic name or select from multi-mechanic option
   - **Description**: Detailed description of work performed
   - **Status**: PROCESSING (default) → APPROVED → FINISHED

### Work Order Statuses
- **PROCESSING**: Work order created, work in progress
- **APPROVED**: Work completed and approved by supervisor
- **FINISHED**: Work order completed and invoiced (requires ID Classic)

### Adding Parts to Work Orders

#### Manual Part Entry
1. **SKU Field**: Enter part SKU number
2. **Auto-completion**: System automatically fills part name and cost from inventory
3. **Quantity**: Enter quantity used
4. **Cost**: Auto-populated from inventory (can be manually adjusted)

#### Pending Parts Integration
- **Pending Parts Preview**: If trailer has pending parts, they appear in green box
- **Add Pending Part**: Click "Add Part" button next to pending part
- **Automatic Processing**: System uses FIFO method to track part usage

### Multi-Mechanic Support
1. **Single Mechanic**: Enter name in "Mechanic" field
2. **Multiple Mechanics**: Use "Add Mechanic" option
   - Enter mechanic name and hours worked
   - System automatically calculates total hours
   - Labor cost calculated at $60/hour

### Extra Options
- **5% Markup**: Adds 5% to total cost
- **15% Shop**: Adds 15% shop markup
- **15% Weld**: Adds 15% welding markup

### Editing Work Orders
1. **Select Work Order**: Click on table row to select
2. **Edit Button**: Click "Edit" button (requires password: 6214)
3. **Load Work Order**: Enter work order ID and password
4. **Make Changes**: Modify any field as needed
5. **Save**: Changes are automatically audited

### Filtering and Search
- **Filter by Week**: Select specific week
- **Filter by Day**: Select specific date
- **Filter by Status**: PROCESSING, APPROVED, FINISHED
- **Filter by ID Classic**: Search by classic ID number

### PDF Generation
- **Automatic**: PDF generated when work order is created/edited
- **Manual**: Click "View PDF" button for existing work orders
- **Invoice Links**: System automatically opens related invoice links

---

## Inventory Management

### Overview
The Inventory module manages parts, receipts, and stock levels with real-time tracking and FIFO deduction.

### Accessing Inventory
1. **From Main Menu**: Click "INVENTORY"
2. **Choose Module**:
   - **MASTER**: Manage inventory items and stock levels
   - **RECEIVE**: Manage incoming receipts and pending parts

### Master Inventory

#### Viewing Inventory
- **Real-time Data**: Updates every 2 minutes
- **Columns Available**:
  - SKU, Bar Code, Category, Part Name
  - Provider, Brand, Unit of Measure (U/M)
  - Area, Received, WO Outputs, On Hand
  - Image Link, Price (USD), Invoice Link

#### Adding New Parts
1. **New Part Button**: Click to open form
2. **Required Fields**:
   - **SKU**: Unique part identifier
   - **Part Name**: Description of the part
   - **Category**: Part category
   - **Provider**: Supplier name
   - **On Hand**: Initial quantity
   - **Price**: Unit cost in USD
3. **Auto-generated**: Bar code automatically created as "BC-{SKU}"
4. **Password Required**: 6214

#### Editing Parts
1. **Select Part**: Click on inventory row
2. **Edit Button**: Requires password (6214)
3. **Modify Fields**: Update any information
4. **Save**: Changes are audited

#### Deleting Parts
1. **Select Part**: Click on inventory row
2. **Delete Button**: Requires password (6214)
3. **Confirmation**: Confirm deletion
4. **Audit Trail**: Deletion is logged

### Receive Inventory

#### Adding Receipts
1. **New Receipt**: Click "New Receipt" button
2. **Required Information**:
   - **SKU**: Part identifier
   - **Category**: Part category
   - **Item**: Part description
   - **Provider**: Supplier
   - **Brand**: Manufacturer
   - **U/M**: Unit of measure
   - **Bill To Co**: Customer/company
   - **Destination Trailer**: Target trailer (if applicable)
   - **Invoice**: Invoice number
   - **Invoice Link**: OneDrive or web link to invoice
   - **Quantity**: Received quantity
   - **Cost + Tax**: Total cost including tax

#### Receipt Status Management
- **PENDING**: Parts received but not yet used
- **USED**: Parts consumed in work orders
- **FIFO Processing**: First In, First Out automatic deduction

#### Editing Receipts
1. **Select Receipt**: Click on table row
2. **Edit Button**: Opens edit form
3. **Update Information**: Modify as needed
4. **Save**: Changes are tracked

---

## Trailer Control

### Overview
Manages trailer fleet status, rental operations, and work order history.

### Trailer Management Features

#### Trailer Status
- **DISPONIBLE**: Available for rent
- **RENTADO**: Currently rented
- **MANTENIMIENTO**: Under maintenance

#### Rental Operations
1. **Rent Trailer**: 
   - Click "📋 Rentar" on available trailer
   - Select client from dropdown
   - Confirm rental dates
   - Status changes to RENTADO

2. **Return Trailer**:
   - Click "↩️ Devolver" on rented trailer
   - Confirm return
   - Status changes to DISPONIBLE

#### Client Management
- **Rental Clients**: AMAZON, WALMART, HOME DEPOT, FEDEX, UPS, TARGET
- **Regular Clients**: GALGRE, JETGRE, PRIGRE, RAN100, GABGRE
- **Client Filtering**: Filter trailers by specific client

#### Trailer History
1. **Rental History**: Click "📊 Historial"
   - View rental periods
   - Client information
   - Dates and duration

2. **Work Order History**: Click "🔧 W.O"
   - View all work orders for trailer
   - Filter by month/year
   - Generate PDFs for work orders

### Trailer Number Ranges
- **GALGRE**: 1-100 to 1-199 (including special TRK units)
- **JETGRE**: 2-001 to 2-016 (plus 2-01 TRK)
- **PRIGRE**: 3-300 to 3-323
- **RAN100**: 4-400 to 4-419
- **GABGRE**: 5-500 to 5-529

---

## Trailer Location

### Overview
Advanced GPS-based trailer tracking and location management system.

### Location Tracking Features

#### Real-time Location
- **GPS Integration**: Real-time position tracking
- **Map View**: Visual representation of trailer locations
- **Status Updates**: Live status and location updates

#### Asset Management
- **Asset Selection**: Choose from available assets
- **Status Monitoring**: Track asset availability
- **Location History**: Historical position data

#### Search and Filter
- **Asset Search**: Find specific trailers
- **Status Filter**: Filter by availability status
- **Location Filter**: Filter by geographic area

---

## Audit Log

### Overview
Complete audit trail for all system operations and changes.

### Audit Features

#### Operation Tracking
- **Work Orders**: Creation, modification, deletion
- **Inventory**: Stock changes, part additions, deductions
- **Trailers**: Rental operations, status changes
- **Receives**: Receipt processing, status updates

#### Audit Information
- **User**: Who performed the action
- **Action**: What was done (CREATE, UPDATE, DELETE)
- **Table**: Which system module was affected
- **Details**: Specific changes made
- **Timestamp**: When the action occurred

#### Filtering Options
- **Date Range**: Filter by specific time period
- **User**: Filter by specific user
- **Operation Type**: Filter by action type
- **Module**: Filter by system module

---

## PDF Generation

### Overview
Automated PDF generation for work orders with invoice integration.

### PDF Features

#### Automatic Generation
- **Work Order Creation**: PDF generated automatically
- **Work Order Updates**: PDF regenerated on changes
- **Status Changes**: New PDF when status changes

#### PDF Content
- **Header Information**: Company details, work order number
- **Work Order Details**: Trailer, date, mechanic, description
- **Parts List**: SKU, description, quantity, cost
- **Labor Information**: Mechanic hours and costs
- **Total Costs**: Parts, labor, and markup calculations
- **Invoice Links**: Clickable links to part invoices

#### Manual PDF Generation
1. **Select Work Order**: Click on table row
2. **View PDF Button**: Click to generate PDF
3. **Invoice Links**: System automatically opens related invoices
4. **Save Options**: PDF saved to system and opened in browser

---

## Troubleshooting

### Common Issues

#### Server Connection
**Problem**: Server shows "Offline" or "Waking up"
**Solution**: 
- Wait 30-60 seconds for server startup
- Click "Reconnect" button
- Refresh browser page if issues persist

#### Work Order Not Saving
**Problem**: Work order form doesn't save
**Solution**:
- Check all required fields are filled
- Verify ID Classic rules (only for FINISHED status)
- Ensure unique ID Classic numbers
- Check internet connection

#### Inventory Not Loading
**Problem**: Inventory table shows no data
**Solution**:
- Wait for automatic refresh (2-minute intervals)
- Check server status indicator
- Refresh browser page
- Verify database connection

#### PDF Generation Fails
**Problem**: PDF doesn't generate or open
**Solution**:
- Check browser popup blocker settings
- Ensure work order has complete data
- Verify invoice links are accessible
- Try manual PDF generation

### Password Requirements
- **Edit Operations**: Password 6214 required for:
  - Work order editing
  - Inventory modifications
  - Part deletions
  - Work order deletions

### Browser Compatibility
- **Recommended**: Chrome, Firefox, Edge (latest versions)
- **Mobile Support**: Responsive design for tablets
- **Internet Required**: System requires stable internet connection

### Data Backup
- **Automatic**: System automatically backs up data
- **Audit Trail**: All changes are logged and preserved
- **PDF Storage**: Generated PDFs stored in system database

### Support Contact
For technical support or system issues:
- Check audit log for error details
- Note exact error messages
- Include steps to reproduce issue
- Contact system administrator with details

---

## Best Practices

### Work Order Management
1. **Complete Information**: Always fill all required fields
2. **Accurate Descriptions**: Provide detailed work descriptions
3. **Part Verification**: Verify SKU numbers before saving
4. **Status Updates**: Keep work order status current
5. **ID Classic**: Use unique ID Classic for FINISHED orders

### Inventory Management
1. **Regular Updates**: Keep inventory levels current
2. **Receipt Processing**: Process receipts promptly
3. **FIFO Method**: System automatically uses oldest stock first
4. **Invoice Links**: Always include invoice links for tracking

### System Usage
1. **Regular Backups**: System handles automatic backups
2. **Data Verification**: Double-check entries before saving
3. **Audit Review**: Regularly review audit logs
4. **PDF Storage**: Keep important PDFs saved locally
5. **Training**: Ensure all users understand system features

---

*This manual covers the complete functionality of Graphical System v2. For additional support or feature requests, contact your system administrator.*
