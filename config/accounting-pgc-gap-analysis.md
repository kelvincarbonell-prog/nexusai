# Accounting And Gestoría Functional Gap Analysis

## Added In This Phase

- PGC account catalog with global system accounts and company-specific extensions.
- Accounting periods with open, locked, and closed states.
- Journal entries and journal lines with debit/credit validation.
- Trial balance data from journal lines.
- Bank accounts and reconciliation table.
- Fixed assets table prepared for amortization workflows.
- VAT ledger prepared for input/output VAT books and fiscal models.
- `/contabilidad` operational view with overview, journal entry form, latest entries, and trial balance.
- API endpoints for PGC account management, fiscal periods, journal posting, and derived reports.
- Journal posting blocks locked/closed fiscal periods and assigns internal entry numbers per company.

## Still To Build Next

- Automatic journal generation from issued invoices, received invoices, payroll, bank imports, and amortizations.
- Full interactive general ledger per account with drill-down from reports.
- Official annual accounts views: balance sheet, profit and loss, statement of changes in equity, and notes support.
- Period close workflow with lock, adjustment entries, regularization, and opening entry for the next year.
- Bank import parsers for Norma 43, CAMT.053, and CSV templates.
- Asset amortization schedule and automatic monthly/yearly amortization entries.
- VAT book exports connected to fiscal models.
- Audit log for posted/voided entries and accounting locks.
- Advisor review workflow for clients that prepare their own accounting.

## Agent Review Gates

- Fiscal agent reviews VAT, P&L, balance sheet, period closing, and tax model traceability.
- Security agent reviews accounting permissions and document links.
- QA/E2E agent tests balanced and unbalanced entries, unauthorized company access, and period locks.
- Performance agent reviews journal and ledger queries before large client imports.
