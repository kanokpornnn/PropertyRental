
/* ========================================
   RentSpace - Property Rental
   Ethereum Sepolia + ethers.js v6
======================================== */

const CONTRACT_ADDRESS =
  "0xC063654Ee15a498b19C64A293EEe2c7164dCFa3b";

const SEPOLIA_CHAIN_ID = "0xaa36a7";

// ABI ของ Smart Contract ที่เรา Deploy ไว้
const CONTRACT_ABI = [
  "function admin() view returns (address)",
  "function propertyCount() view returns (uint256)",
  "function agreementCount() view returns (uint256)",

  "function properties(uint256) view returns (uint256 id, address owner, string name, uint256 rent, uint256 deposit)",

  "function agreements(uint256) view returns (uint256 id, uint256 propertyId, address tenant, uint256 startDate, uint256 endDate, bool confirmed, bool deposited, bool refunded, bool disputed, bool resolved, uint256 depositAmount, uint256 rentPaid, uint256 refundAmount, uint256 ownerAmount)",

  "function registerProperty(string _name, uint256 _rent, uint256 _deposit)",

  "function createAgreement(uint256 _propertyId, address _tenant, uint256 _startDate, uint256 _endDate)",

  "function confirmAgreement(uint256 _id)",

  "function depositSecurity(uint256 _id) payable",

  "function recordRentalPayment(uint256 _id) payable",

  "function refundDeposit(uint256 _id)",

  "function raiseDispute(uint256 _id)",

  "function resolveDispute(uint256 _id, uint256 _tenantAmount, uint256 _ownerAmount)"
];

let provider = null;
let signer = null;
let contract = null;
let walletAddress = null;

const $ = (id) => document.getElementById(id);

// ========================================
// 1. MENU NAVIGATION
// ========================================

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.remove("active");
  });

  const selectedPage = $(pageId);

  if (!selectedPage) return;

  selectedPage.classList.add("active");

  const activeMenu = document.querySelector(
    `.menu-item[data-page="${pageId}"]`
  );

  if (activeMenu) {
    activeMenu.classList.add("active");
  }

  const pageTitles = {
    dashboard: "Dashboard",
    property: "ลงทะเบียนห้องเช่า",
    agreement: "สร้างสัญญาเช่า",
    confirm: "ยืนยันสัญญา",
    deposit: "ฝากเงินประกัน",
    payment: "ชำระค่าเช่า",
    refund: "คืนเงินประกัน",
    dispute: "จัดการข้อพิพาท"
  };

  $("pageTitle").textContent =
    pageTitles[pageId] || "RentSpace";

  $("statusMessage").className = "status-message";
  $("statusMessage").textContent = "";

  if (pageId === "dashboard" && contract) {
    loadDashboard();
  }
}

document.querySelectorAll(".menu-item").forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.go);
  });
});

// ========================================
// 2. STATUS MESSAGE
// ========================================

function showStatus(message, type = "info") {
  const statusBox = $("statusMessage");

  statusBox.textContent = message;
  statusBox.className = `status-message ${type}`;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ========================================
// 3. CONNECT METAMASK
// ========================================

async function connectWallet() {
  try {
    if (!window.ethereum) {
      showStatus(
        "ไม่พบ MetaMask กรุณาติดตั้ง MetaMask ก่อนใช้งาน",
        "error"
      );
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    if (!accounts.length) {
      throw new Error("ไม่พบบัญชี MetaMask");
    }

    const chainId = await window.ethereum.request({
      method: "eth_chainId"
    });

    if (chainId !== SEPOLIA_CHAIN_ID) {
      showStatus(
        "กำลังเปลี่ยนเครือข่ายเป็น Sepolia...",
        "info"
      );

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [
          { chainId: SEPOLIA_CHAIN_ID }
        ]
      });
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    walletAddress = await signer.getAddress();

    contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer
    );

    $("connectWallet").textContent =
      shortAddress(walletAddress);

    showStatus(
      "เชื่อมต่อ MetaMask สำเร็จแล้ว",
      "success"
    );

    await loadDashboard();

  } catch (error) {
    handleError(error);
  }
}

$("connectWallet").addEventListener(
  "click",
  connectWallet
);

// ========================================
// 4. DASHBOARD
// ========================================

async function loadDashboard() {
  if (!contract) return;

  try {
    const propertyTotal =
      await contract.propertyCount();

    const agreementTotal =
      await contract.agreementCount();

    $("propertyCount").textContent =
      propertyTotal.toString();

    $("agreementCount").textContent =
      agreementTotal.toString();

  } catch (error) {
    handleError(error);
  }
}

// ========================================
// 5. TRANSACTION HELPER
// ========================================

function requireWallet() {
  if (!contract || !signer) {
    throw new Error(
      "กรุณากด Connect Wallet ก่อนทำรายการ"
    );
  }

  return contract;
}

async function sendTransaction(transactionPromise) {
  showStatus(
    "กรุณาตรวจสอบและยืนยันธุรกรรมใน MetaMask",
    "info"
  );

  const tx = await transactionPromise;

  showStatus(
    "ส่งธุรกรรมแล้ว กำลังรอยืนยันบน Blockchain...",
    "info"
  );

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("ธุรกรรมไม่สำเร็จ");
  }

  showStatus(
    `ทำรายการสำเร็จ! Transaction: ${tx.hash}`,
    "success"
  );

  await loadDashboard();
}

function handleError(error) {
  console.error(error);

  let message =
    error.reason ||
    error.shortMessage ||
    error.message ||
    "เกิดข้อผิดพลาด";

  if (error.code === 4001 ||
      error.code === "ACTION_REJECTED") {
    message = "คุณยกเลิกธุรกรรมใน MetaMask";
  }

  showStatus(message, "error");
}

// ========================================
// 6. REGISTER PROPERTY
// ========================================

$("propertyForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const c = requireWallet();

      const name =
        $("propertyName").value.trim();

      const rent = ethers.parseEther(
        $("propertyRent").value
      );

      const deposit = ethers.parseEther(
        $("propertyDeposit").value
      );

      await sendTransaction(
        c.registerProperty(name, rent, deposit)
      );

      event.target.reset();

    } catch (error) {
      handleError(error);
    }
  }
);

// ========================================
// 7. CREATE AGREEMENT
// ========================================

$("agreementForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const c = requireWallet();

      const propertyId =
        $("agreementPropertyId").value;

      const tenant =
        $("tenantAddress").value.trim();

      if (!ethers.isAddress(tenant)) {
        throw new Error(
          "Wallet Address ของผู้เช่าไม่ถูกต้อง"
        );
      }

      const startDate = Math.floor(
        new Date($("startDate").value).getTime() / 1000
      );

      const endDate = Math.floor(
        new Date($("endDate").value).getTime() / 1000
      );

      if (
        !Number.isFinite(startDate) ||
        !Number.isFinite(endDate)
      ) {
        throw new Error("กรุณาเลือกวันที่ให้ถูกต้อง");
      }

      if (endDate <= startDate) {
        throw new Error(
          "วันสิ้นสุดต้องอยู่หลังวันเริ่มสัญญา"
        );
      }

      if (endDate <= Math.floor(Date.now() / 1000)) {
        throw new Error(
          "วันสิ้นสุดสัญญาต้องอยู่ในอนาคต"
        );
      }

      await sendTransaction(
        c.createAgreement(
          propertyId,
          tenant,
          startDate,
          endDate
        )
      );

      event.target.reset();

    } catch (error) {
      handleError(error);
    }
  }
);

// ========================================
// 8. CONFIRM AGREEMENT
// ========================================

$("confirmForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const c = requireWallet();

      const agreementId =
        $("confirmId").value;

      await sendTransaction(
        c.confirmAgreement(agreementId)
      );

      event.target.reset();

    } catch (error) {
      handleError(error);
    }
  }
);

// ========================================
// 9. DEPOSIT SECURITY
// ========================================

$("depositForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const c = requireWallet();

      const agreementId =
        $("depositId").value;

      const agreement =
        await c.agreements(agreementId);

      const depositAmount =
        agreement.depositAmount;

      if (depositAmount <= 0n) {
        throw new Error(
          "ไม่พบเงินประกันของสัญญานี้"
        );
      }

      await sendTransaction(
        c.depositSecurity(agreementId, {
          value: depositAmount
        })
      );

      event.target.reset();

    } catch (error) {
      handleError(error);
    }
  }
);

// ========================================
// 10. RENTAL PAYMENT
// ========================================

$("paymentForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const c = requireWallet();

      const agreementId =
        $("paymentId").value;

      const agreement =
        await c.agreements(agreementId);

      const property =
        await c.properties(agreement.propertyId);

      const rentAmount = property.rent;

      if (rentAmount <= 0n) {
        throw new Error(
          "ไม่พบค่าเช่าของห้องนี้"
        );
      }

      await sendTransaction(
        c.recordRentalPayment(agreementId, {
          value: rentAmount
        })
      );

      event.target.reset();

    } catch (error) {
      handleError(error);
    }
  }
);

// ========================================
// 11. REFUND DEPOSIT
// ========================================

$("refundForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const c = requireWallet();

      const agreementId =
        $("refundId").value;

      await sendTransaction(
        c.refundDeposit(agreementId)
      );

      event.target.reset();

    } catch (error) {
      handleError(error);
    }
  }
);

// ========================================
// 12. RAISE DISPUTE
// ========================================

$("disputeForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const c = requireWallet();

      const agreementId =
        $("disputeId").value;

      await sendTransaction(
        c.raiseDispute(agreementId)
      );

      event.target.reset();

    } catch (error) {
      handleError(error);
    }
  }
);

// ========================================
// 13. RESOLVE DISPUTE
// ========================================

$("resolveForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const c = requireWallet();

      const agreementId =
        $("resolveId").value;

      const tenantAmount = ethers.parseEther(
        $("tenantAmount").value
      );

      const ownerAmount = ethers.parseEther(
        $("ownerAmount").value
      );

      const agreement =
        await c.agreements(agreementId);

      if (
        tenantAmount + ownerAmount !==
        agreement.depositAmount
      ) {
        throw new Error(
          "จำนวนเงินรวมต้องเท่ากับเงินประกัน"
        );
      }

      await sendTransaction(
        c.resolveDispute(
          agreementId,
          tenantAmount,
          ownerAmount
        )
      );

      event.target.reset();

    } catch (error) {
      handleError(error);
    }
  }
);

// ========================================
// 14. METAMASK ACCOUNT / NETWORK CHANGE
// ========================================

if (window.ethereum) {
  window.ethereum.on(
    "accountsChanged",
    () => {
      provider = null;
      signer = null;
      contract = null;
      walletAddress = null;

      $("connectWallet").textContent =
        "Connect Wallet";

      $("propertyCount").textContent = "—";
      $("agreementCount").textContent = "—";

      showStatus(
        "บัญชี MetaMask เปลี่ยนแล้ว กรุณาเชื่อมต่อใหม่",
        "info"
      );
    }
  );

  window.ethereum.on(
    "chainChanged",
    () => {
      provider = null;
      signer = null;
      contract = null;
      walletAddress = null;

      $("connectWallet").textContent =
        "Connect Wallet";

      $("propertyCount").textContent = "—";
      $("agreementCount").textContent = "—";

      showStatus(
        "เครือข่ายเปลี่ยนแล้ว กรุณาเชื่อมต่อใหม่",
        "info"
      );
    }
  );
}

console.log("RentSpace JavaScript loaded");
