TimeToPay Application - Prototype Version

This is a money application which tracks expenditure and income and assists with budgeting and overall financial insight which helps the user manage their accounts better. 

This prototype is developed on a frontend scheme using HTML to replicate what a deployed version would look like. 


# File Scheme

src/\
|__js/\
|_____alerts.js\
|_____app.js\
|_____auth.js\
|_____bills.js\
|_____budgets.js\
|_____demo.js\
|_____profile.js\
|_____reports.js\
|_____storage.js\
|_____transactions.js\
|__index.html\
|__styles.css\
|__README.md


# JS Files

alerts.js\
 --> Warnings that pop up such as budget is almost done or bill is due soon.\
app.js\
 --> Handles the navigation level buttons and packages the entire script together. Primary main branch.\
auth.js\
 --> Password Login and Logout (Secure and encryption would live here for full deployed application)\
bills.js\
 --> Used to add bills, pay them, and enable/disable autopay.\
budgets.js\
 --> Create monthly budgets for food, personal, entertainment etc and integrated savings feature for savings accounts.\
demo.js\
 --> Admin only integration to create mass amounts of random transactions, budgets, income, refunds,  bills and such to populate the prototype for testing with random data. \
profile.js\
 --> Update user name, email, password, light/dark settings. \
reports.js\
 --> This is the analyticial tab where graphs show 6 month data, category bars and allows for compacted CSV file usable on Excel or Google Sheets for bulk view of income, expenses, and all transactions. This section can split different reports per month and also displays analytical statistics.\
storage.js\
 --> For this prototype, the data is stored in cache in the users local till full reloaded or reset as we do not have an integrated postgreSQL database within the backend of this application yet. Allows for similar workflow that mimics a real application we have intended.\
transactions.js\
 --> Add income, add expenses, historical view of all transactions, and modify/delete them. \


# SRC Files

index.html\
 --> This is the primary web page, it creates a UI that replicates the phone. All the screens that are in our application run from here and are visible or hidden based on which tab is selected at a time.\
styles.css\
 --> All the themes, shapes, colors, and different modes (dark/light mode) is held here and can be easily modified.



# Running

Simply ensure in one folder "TimeToPay" all directories and files are there\
JS folder\
index.html\
styles.css

Run index.html in local browser\
-> At this point, the application is deployed.
