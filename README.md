# Graphical System Project

## Overview
This project is a graphical system that includes a user management feature with a login interface, a menu for navigating between Work Orders and Inventory, and a detailed Work Orders screen that displays a table of work orders along with various action buttons.

## Features
- **User Management**: Users can log in to access the system.
- **Menu Navigation**: A menu that allows users to switch between Work Orders and Inventory.
- **Work Orders Screen**: A detailed view of work orders presented in a table format with action buttons for managing work orders.

## Project Structure
```
graphical-system
├── src
│   ├── components
│   │   ├── Login
│   │   │   ├── LoginForm.tsx
│   │   │   └── LoginStyles.ts
│   │   ├── Menu
│   │   │   ├── MenuOptions.tsx
│   │   │   └── MenuStyles.ts
│   │   ├── WorkOrders
│   │   │   ├── WorkOrdersTable.tsx
│   │   │   ├── WorkOrdersButtons.tsx
│   │   │   └── WorkOrdersStyles.ts
│   │   └── Inventory
│   │       ├── InventoryList.tsx
│   │       └── InventoryStyles.ts
│   ├── services
│   │   ├── authService.ts
│   │   ├── userService.ts
│   │   └── workOrderService.ts
│   ├── utils
│   │   └── helpers.ts
│   ├── App.tsx
│   └── index.tsx
├── public
│   └── index.html
├── package.json
├── tsconfig.json
└── README.md
```

## Installation
1. Clone the repository.
2. Navigate to the project directory.
3. Run `npm install` to install the dependencies.

## Usage
- Start the application by running `npm start`.
- Access the login page to authenticate users.
- Use the menu to navigate between Work Orders and Inventory sections.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.