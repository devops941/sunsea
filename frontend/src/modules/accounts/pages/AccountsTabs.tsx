import React from "react";
import { Container } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaMoneyBillWave,
  FaReceipt,
  FaBook,
  FaSitemap,
  FaFileInvoiceDollar,
  FaUndoAlt,
  FaCoins
} from "react-icons/fa";
import Tabs from "../../../components/ui/tab/Tabs";
import type { TabItem } from "../../../components/ui/tab/Tabs";

import { AmountPayablePage } from "./payable/AmountPayablePage";
import { AmountReceivablePage } from "./receivable/AmountReceivablePage";
import ChartOfAccountsPage from "./chart-of-accounts/ChartOfAccountsPage";
import LedgerStatementPage from "./ledger-statement/LedgerStatementPage";
import { PaymentVoucherPage } from "./vouchers/PaymentVoucherPage";
import { VoucherListPage } from "./vouchers/VoucherListPage";
import { SalesReturnPage } from "./returns/SalesReturnPage";
import { PurchaseReturnPage } from "./returns/PurchaseReturnPage";
import { PettyCashPage } from "./petty-cash/PettyCashPage";

const PlaceholderTab: React.FC<{ name: string }> = ({ name }) => (
  <div className="p-8 text-center bg-white border border-slate-200 rounded-xl shadow-sm my-4">
    <h3 className="text-xl font-bold text-slate-800 mb-2">{name} Module</h3>
    <p className="text-slate-500 max-w-md mx-auto">
      This accounts module ({name}) is currently under active setup.
    </p>
  </div>
);

const AccountsTabs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const pathToKey: Record<string, string> = {
    "/accounts/payable": "payable",
    "/accounts/receivable": "receivable",
    "/accounts/ledger-statement": "ledger-statement",
    "/accounts/chart-of-accounts": "chart-of-accounts",
    "/accounts/vouchers": "vouchers",
    "/accounts/sales-returns": "sales-returns",
    "/accounts/purchase-returns": "purchase-returns",
    "/accounts/petty-cash": "petty-cash"
  };

  const keyToPath: Record<string, string> = {
    payable: "/accounts/payable",
    receivable: "/accounts/receivable",
    "ledger-statement": "/accounts/ledger-statement",
    "chart-of-accounts": "/accounts/chart-of-accounts",
    vouchers: "/accounts/vouchers",
    "sales-returns": "/accounts/sales-returns",
    "purchase-returns": "/accounts/purchase-returns",
    "petty-cash": "/accounts/petty-cash"
  };

  const activeTab = pathToKey[location.pathname] || "payable";

  const tabs: TabItem[] = [
    {
      key: "payable",
      label: "Amount Payable",
      icon: <FaMoneyBillWave />,
      content: <AmountPayablePage />
    },
    {
      key: "receivable",
      label: "Amount Receivable",
      icon: <FaReceipt />,
      content: <AmountReceivablePage />
    },
    {
      key: "ledger-statement",
      label: "Ledger Statement",
      icon: <FaBook />,
      content: <LedgerStatementPage />
    },
    {
      key: "chart-of-accounts",
      label: "Chart of Accounts",
      icon: <FaSitemap />,
      content: <ChartOfAccountsPage />
    },
    {
      key: "vouchers",
      label: "Vouchers Register",
      icon: <FaFileInvoiceDollar />,
      content: <VoucherListPage />
    },
    {
      key: "sales-returns",
      label: "Sales Returns",
      icon: <FaUndoAlt />,
      content: <SalesReturnPage />
    },
    {
      key: "purchase-returns",
      label: "Purchase Returns",
      icon: <FaUndoAlt />,
      content: <PurchaseReturnPage />
    },
    {
      key: "petty-cash",
      label: "Petty Cash",
      icon: <FaCoins />,
      content: <PettyCashPage />
    }
  ];

  const handleTabChange = (key: string) => {
    const targetPath = keyToPath[key];
    if (targetPath) {
      navigate(targetPath);
    }
  };

  return (
    <div className="inner-container">
      <Container fluid>
        <Tabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} align="left" />
      </Container>
    </div>
  );
};

export default AccountsTabs;
