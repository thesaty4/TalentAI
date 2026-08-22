import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeSeed {
  code: string;
  name: string;
  role: string;
  bu: string;
  location: string;
  exp: number;
  status: 'Bench' | 'Allocated';
  allocation?: string;
  available?: string; // ISO date
  notice?: string;
  skills: string[];
  history: { project: string; client?: string; duration?: string; desc: string; tags: string[] }[];
  rating?: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const ALL_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Kotlin', 'Swift', 'C#', 'Dart',
  'React', 'Angular', 'Vue.js', 'Next.js', 'Node.js', 'Django', 'FastAPI', 'Flask',
  'Spring Boot', 'Spring', '.NET', 'Express.js',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Terraform', 'Helm',
  'Kafka', 'RabbitMQ', 'gRPC', 'REST APIs', 'GraphQL',
  'Payments APIs', 'Settlement Systems', 'Reconciliation',
  'Selenium', 'Cypress', 'Jest', 'Pytest', 'TestNG', 'JMeter',
  'Spark', 'Airflow', 'dbt', 'BigQuery', 'Pandas',
  'CI/CD', 'Jenkins', 'GitHub Actions', 'ArgoCD', 'Ansible',
  'Microservices', 'React Native', 'Flutter', 'Android',
];

// 8 named employees — exact data per spec
const NAMED_EMPLOYEES: EmployeeSeed[] = [
  {
    code: 'EMP1042', name: 'Satya Mishra', role: 'Senior Python Engineer',
    bu: 'Payments & FinTech', location: 'Pune', exp: 6,
    status: 'Allocated', allocation: 'Internal Tools Migration (ends 30 Aug 2026)',
    available: '2026-09-02', notice: 'Needs 2 weeks notice',
    skills: ['Python', 'Django', 'Payments APIs', 'REST APIs', 'PostgreSQL'],
    history: [{ project: 'Fintech Payments Integration', client: 'Axis Capital', duration: '8 months',
      desc: 'Spent 8 months building a payments integration for a fintech client, owning reconciliation and settlement flows.',
      tags: ['Payments', 'FinTech', 'Reconciliation'] }],
    rating: 'Exceeding',
  },
  {
    code: 'EMP1088', name: 'Prince Verma', role: 'Backend Engineer',
    bu: 'Healthcare & Insurance', location: 'Bengaluru', exp: 4,
    status: 'Bench', allocation: 'Bench — available now',
    skills: ['Python', 'Node.js', 'PostgreSQL', 'Redis', 'REST APIs'],
    history: [{ project: 'Claims Processing Platform', client: 'HealthFirst', duration: '1.5 years',
      desc: 'Built a claims-processing backend service handling high transaction volume over 1.5 years.',
      tags: ['Healthcare', 'Claims', 'High Volume'] }],
    rating: 'Exceeding',
  },
  {
    code: 'EMP1121', name: 'Renu Saraswat', role: 'Full-Stack Engineer',
    bu: 'Payments & FinTech', location: 'Remote', exp: 5,
    status: 'Bench', allocation: 'Bench — available now',
    skills: ['React', 'Node.js', 'Python', 'TypeScript', 'PostgreSQL'],
    history: [{ project: 'Merchant Payments Dashboard', client: 'PayEdge', duration: '2 years',
      desc: 'Led the reporting module of a merchant-facing payments dashboard for two years, owning data visualisation and API integration.',
      tags: ['Payments', 'Dashboard', 'FinTech'] }],
    rating: 'Exceeding',
  },
  {
    code: 'EMP1155', name: 'Soumyadeep Nayak', role: 'Platform Engineer',
    bu: 'Payments & FinTech', location: 'Noida', exp: 7,
    status: 'Allocated', allocation: 'Logistics Tracker API (ends 10 Sep 2026)',
    available: '2026-09-10', notice: 'Needs 2 weeks notice',
    skills: ['Python', 'Kubernetes', 'AWS', 'Terraform', 'Docker', 'Helm'],
    history: [{ project: 'High-Volume Transaction Platform', client: 'Razorpay', duration: '3 years',
      desc: 'Infra lead on a high-volume transaction platform for 3 years — owned SRE, on-call runbooks, and 99.99% uptime SLAs.',
      tags: ['Payments', 'Infrastructure', 'SRE'] }],
    rating: 'Exceeding',
  },
  {
    code: 'EMP1190', name: 'Aditya Singh', role: 'QA Automation Engineer',
    bu: 'Payments & FinTech', location: 'Chennai', exp: 3,
    status: 'Bench', allocation: 'Bench — available now',
    skills: ['Python', 'Selenium', 'CI/CD', 'Pytest', 'REST APIs'],
    history: [{ project: 'Payment Reconciliation QA', client: 'HDFC Merchant Services', duration: '1 year',
      desc: 'Tested payment reconciliation flows at a previous employer for 1 year — built regression suites covering settlement edge cases.',
      tags: ['Payments', 'QA', 'Reconciliation'] }],
    rating: 'Meeting',
  },
  {
    code: 'EMP1204', name: 'Amit Gupta', role: 'Backend Engineer',
    bu: 'Healthcare & Insurance', location: 'Hyderabad', exp: 5,
    status: 'Bench', allocation: 'Bench — available now',
    skills: ['Java', 'Spring', 'Spring Boot', 'Python', 'MySQL'],
    history: [{ project: 'Insurance Policy Management Portal', client: 'Meridian Assurance', duration: '2 years',
      desc: 'Built REST APIs for an insurance policy management portal — no direct payments project history on record.',
      tags: ['Insurance', 'Policy Management'] }],
    rating: 'Meeting',
  },
  {
    code: 'EMP1233', name: 'Amodh Mandloi', role: 'Data Engineer',
    bu: 'Retail & eCommerce', location: 'Bengaluru', exp: 6,
    status: 'Bench', allocation: 'Bench — available now',
    skills: ['Python', 'Spark', 'Airflow', 'dbt', 'BigQuery', 'Pandas'],
    history: [{ project: 'Retail Analytics Pipeline', client: 'Corestone Retail', duration: '2.5 years',
      desc: 'Designed and owned ETL pipelines for a retail analytics platform — ingested 50M+ daily events into BigQuery with sub-hour latency.',
      tags: ['Retail', 'Data Engineering', 'Analytics'] }],
    rating: 'Exceeding',
  },
  {
    code: 'EMP1267', name: 'Anish Mishra', role: 'Mobile Engineer',
    bu: 'Payments & FinTech', location: 'Remote', exp: 4,
    status: 'Bench', allocation: 'Bench — available now',
    skills: ['Kotlin', 'Swift', 'Python', 'React Native', 'REST APIs'],
    history: [{ project: 'Consumer Payments Mobile App', client: 'NovaPay', duration: '1.5 years',
      desc: 'Built a consumer payments mobile app for 1.5 years — owned the checkout flow, wallet top-up, and PCI-DSS compliance layer.',
      tags: ['Payments', 'Mobile', 'FinTech'] }],
    rating: 'Meeting',
  },
];

// 57 generated employees — varied roles, locations, evidence-bearing histories
const GENERATED_EMPLOYEES: EmployeeSeed[] = [
  { code:'EMP1301', name:'Ankit Sanpuria', role:'Backend Engineer', bu:'Payments & FinTech', location:'Pune', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Python','Django','REST APIs','PostgreSQL','Redis'], history:[{ project:'Loan Origination Platform', client:'CapitalFirst', duration:'1.5 years', desc:'Led backend development for a loan origination platform, handling document verification APIs and underwriting decision engine.', tags:['FinTech','Lending'] }], rating:'Meeting' },
  { code:'EMP1302', name:'Archit Tyagi', role:'Frontend Engineer', bu:'Digital Platform', location:'Bengaluru', exp:3, status:'Bench', allocation:'Bench — available now', skills:['React','TypeScript','Next.js','Tailwind CSS','GraphQL'], history:[{ project:'Investment Tracker Dashboard', client:'WealthEdge', duration:'1 year', desc:'Built the customer-facing dashboard for an investment tracking app — complex React state management for real-time portfolio updates.', tags:['FinTech','Dashboard'] }], rating:'Meeting' },
  { code:'EMP1303', name:'Arvind Kumar', role:'DevOps Engineer', bu:'Logistics & Supply Chain', location:'Noida', exp:6, status:'Allocated', allocation:'Atlas Freight (ends 15 Sep 2026)', available:'2026-09-15', notice:'Needs 2 weeks notice', skills:['Kubernetes','AWS','Terraform','Docker','CI/CD','Ansible'], history:[{ project:'Freight Tracking Infrastructure', client:'Atlas Freight', duration:'2 years', desc:'Redesigned CI/CD pipelines and container orchestration for a freight-tracking platform, reducing deployment time by 70%.', tags:['Logistics','Infrastructure'] }], rating:'Exceeding' },
  { code:'EMP1304', name:'Atharva Thenge', role:'Full-Stack Engineer', bu:'Payments & FinTech', location:'Hyderabad', exp:4, status:'Bench', allocation:'Bench — available now', skills:['React','Node.js','Python','PostgreSQL','Docker'], history:[{ project:'Payment Gateway Integration', client:'QuickCash', duration:'10 months', desc:'Owned end-to-end development of a payment gateway integration including the merchant dashboard and webhook processing layer.', tags:['Payments','FinTech'] }], rating:'Meeting' },
  { code:'EMP1305', name:'Gaurav Dhapola', role:'Backend Engineer', bu:'Healthcare & Insurance', location:'Mumbai', exp:7, status:'Bench', allocation:'Bench — available now', skills:['Java','Spring Boot','Kafka','PostgreSQL','Microservices'], history:[{ project:'Claims Settlement Engine', client:'SunHealth', duration:'3 years', desc:'Architected and led a claims settlement microservices engine — processed 200K daily claims with event-driven Kafka pipelines.', tags:['Healthcare','Claims','Settlement'] }], rating:'Exceeding' },
  { code:'EMP1306', name:'Gaurav Sharma', role:'QA Automation Engineer', bu:'Healthcare & Insurance', location:'Chennai', exp:4, status:'Bench', allocation:'Bench — available now', skills:['Python','Selenium','TestNG','JMeter','CI/CD'], history:[{ project:'EHR System Testing', client:'MedTech Solutions', duration:'1.5 years', desc:'Led QA automation for an EHR system — built a 500+ test suite covering HIPAA-sensitive data flows.', tags:['Healthcare','QA'] }], rating:'Meeting' },
  { code:'EMP1307', name:'Harshal There', role:'Data Engineer', bu:'Payments & FinTech', location:'Bengaluru', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Python','Spark','Airflow','AWS','PostgreSQL'], history:[{ project:'Transaction Risk Analytics', client:'PaySecure', duration:'2 years', desc:'Built real-time transaction risk-scoring pipelines using Spark Streaming — flagged fraud patterns across 10M+ daily transactions.', tags:['Payments','Analytics','Risk'] }], rating:'Exceeding' },
  { code:'EMP1308', name:'Himanshu Tyagi', role:'Backend Engineer', bu:'Digital Platform', location:'Remote', exp:4, status:'Bench', allocation:'Bench — available now', skills:['Go','gRPC','PostgreSQL','Docker','Kubernetes'], history:[{ project:'API Gateway Service', client:'Navi Technologies', duration:'1.5 years', desc:'Designed and built a high-throughput gRPC-based API gateway handling 50K RPS for a consumer fintech app.', tags:['FinTech','API','High Throughput'] }], rating:'Meeting' },
  { code:'EMP1309', name:'Jitin Gupta', role:'Platform Engineer', bu:'Retail & eCommerce', location:'Pune', exp:8, status:'Bench', allocation:'Bench — available now', skills:['AWS','Terraform','Kubernetes','ArgoCD','Helm'], history:[{ project:'Retail Platform Migration', client:'ShopMax India', duration:'2.5 years', desc:'Led cloud migration of a monolithic retail platform to AWS microservices — achieved 40% infra cost reduction.', tags:['Retail','Cloud Migration','AWS'] }], rating:'Exceeding' },
  { code:'EMP1310', name:'Komal Singh', role:'Full-Stack Engineer', bu:'Healthcare & Insurance', location:'Hyderabad', exp:6, status:'Bench', allocation:'Bench — available now', skills:['React','Java','Spring Boot','MySQL','Docker'], history:[{ project:'Patient Portal', client:'Apollo Health', duration:'2 years', desc:'Built a patient-facing portal for appointment scheduling and lab results — integrated with FHIR APIs.', tags:['Healthcare','Portal'] }], rating:'Meeting' },
  { code:'EMP1311', name:'Kshama Thikane', role:'Mobile Engineer', bu:'Retail & eCommerce', location:'Noida', exp:3, status:'Bench', allocation:'Bench — available now', skills:['Kotlin','Android','React Native','REST APIs','Firebase'], history:[{ project:'Retail Loyalty App', client:'Corestone Retail', duration:'1 year', desc:'Built the Android loyalty app — implemented gamification, push notifications, and in-app payments integration.', tags:['Retail','Mobile','Loyalty'] }], rating:'Meeting' },
  { code:'EMP1312', name:'Mahima Makkar', role:'Backend Engineer', bu:'Payments & FinTech', location:'Bengaluru', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Python','FastAPI','PostgreSQL','Redis','Payments APIs'], history:[{ project:'UPI Integration Platform', client:'PayFlow', duration:'2 years', desc:'Built the UPI integration layer handling 5M daily transactions — owned settlement reconciliation and dispute resolution APIs.', tags:['Payments','UPI','FinTech'] }], rating:'Exceeding' },
  { code:'EMP1313', name:'Malika Bindal', role:'DevOps Engineer', bu:'Digital Platform', location:'Hyderabad', exp:5, status:'Bench', allocation:'Bench — available now', skills:['GCP','Kubernetes','Docker','Jenkins','Terraform'], history:[{ project:'SaaS Platform DevOps', client:'TechBridge', duration:'2 years', desc:'Owned the entire DevOps lifecycle for a multi-tenant SaaS platform — zero-downtime deployments with blue-green on GKE.', tags:['SaaS','DevOps','GCP'] }], rating:'Meeting' },
  { code:'EMP1314', name:'Manikarnika Kukreti', role:'Data Engineer', bu:'Retail & eCommerce', location:'Chennai', exp:4, status:'Bench', allocation:'Bench — available now', skills:['Python','dbt','Airflow','BigQuery','Pandas'], history:[{ project:'E-Commerce Analytics Warehouse', client:'BuyMart', duration:'1.5 years', desc:'Built the data warehouse and dbt transformation layer for an e-commerce platform — powered merchandising and pricing dashboards.', tags:['Retail','Analytics','Data Warehouse'] }], rating:'Meeting' },
  { code:'EMP1315', name:'Nidhi Bharti', role:'Backend Engineer', bu:'Digital Platform', location:'Pune', exp:4, status:'Bench', allocation:'Bench — available now', skills:['Node.js','TypeScript','PostgreSQL','Kafka','Docker'], history:[{ project:'Notification Delivery Platform', client:'InfraComm', duration:'1 year', desc:'Built a multi-channel notification delivery platform (email, SMS, push) processing 2M events/day with Kafka and Node.js workers.', tags:['Platform','Notifications','High Volume'] }], rating:'Meeting' },
  { code:'EMP1316', name:'Nitin Tyagi', role:'Frontend Engineer', bu:'Healthcare & Insurance', location:'Kolkata', exp:4, status:'Bench', allocation:'Bench — available now', skills:['Angular','TypeScript','RxJS','REST APIs','Jest'], history:[{ project:'Insurance Customer Portal', client:'Meridian Health', duration:'1.5 years', desc:'Built the customer-facing Angular portal for policy management — handled complex multi-step claims submission flows.', tags:['Healthcare','Insurance','Portal'] }], rating:'Meeting' },
  { code:'EMP1317', name:'Nitish Kumar', role:'Backend Engineer', bu:'Payments & FinTech', location:'Bengaluru', exp:6, status:'Bench', allocation:'Bench — available now', skills:['Python','Django','PostgreSQL','Kafka','REST APIs'], history:[{ project:'Merchant Onboarding API', client:'PayCraft', duration:'2 years', desc:'Designed the merchant onboarding API service — KYC verification, bank account validation, and payout configuration for 10K+ merchants.', tags:['Payments','Merchant','FinTech'] }], rating:'Exceeding' },
  { code:'EMP1318', name:'P Chandrakala', role:'QA Automation Engineer', bu:'Logistics & Supply Chain', location:'Noida', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Java','TestNG','Selenium','REST APIs','CI/CD'], history:[{ project:'Logistics Platform QA', client:'Atlas Freight', duration:'2 years', desc:'Led QA for a logistics tracking platform — end-to-end automation covering order lifecycle and third-party carrier integrations.', tags:['Logistics','QA','Automation'] }], rating:'Meeting' },
  { code:'EMP1319', name:'Pankaj Sharma', role:'Backend Engineer', bu:'Digital Platform', location:'Mumbai', exp:3, status:'Bench', allocation:'Bench — available now', skills:['Python','Flask','REST APIs','MySQL','Docker'], history:[{ project:'Internal HR Tool APIs', client:'Internal', duration:'1 year', desc:'Built the backend APIs for an internal HR tool covering employee self-service, leave management, and payroll integration.', tags:['Internal Tools','HR'] }], rating:'Below' },
  { code:'EMP1320', name:'Pragya Sharma', role:'Solutions Architect', bu:'Payments & FinTech', location:'Bengaluru', exp:10, status:'Bench', allocation:'Bench — available now', skills:['AWS','Microservices','Kafka','PostgreSQL','Python','Node.js'], history:[{ project:'Core Banking Modernisation', client:'Federal Bank', duration:'3 years', desc:'Led solution architecture for core banking modernisation — defined microservices boundaries, API contracts, and event-driven architecture for 5M accounts.', tags:['Banking','FinTech','Architecture'] }], rating:'Exceeding' },
  { code:'EMP1321', name:'Rajat Saraswat', role:'Backend Engineer', bu:'Healthcare & Insurance', location:'Gurugram', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Java','Spring Boot','Kubernetes','MySQL','REST APIs'], history:[{ project:'Medical Records API', client:'HealthBridge', duration:'2 years', desc:'Built secure RESTful APIs for a medical records exchange platform, handling HL7 FHIR compliance and patient consent flows.', tags:['Healthcare','FHIR','Medical Records'] }], rating:'Meeting' },
  { code:'EMP1322', name:'Ram Singh', role:'Frontend Engineer', bu:'Digital Platform', location:'Pune', exp:3, status:'Bench', allocation:'Bench — available now', skills:['Vue.js','TypeScript','REST APIs','Tailwind CSS','Cypress'], history:[{ project:'Internal Operations Dashboard', client:'Internal', duration:'10 months', desc:'Built the internal operations dashboard for monitoring SLA breaches and ticket escalations — real-time data via WebSockets.', tags:['Internal Tools','Dashboard'] }], rating:'Meeting' },
  { code:'EMP1323', name:'Riya Gupta', role:'Backend Engineer', bu:'Logistics & Supply Chain', location:'Chennai', exp:7, status:'Bench', allocation:'Bench — available now', skills:['Python','Django','PostgreSQL','REST APIs','Celery'], history:[{ project:'Supply Chain Visibility Platform', client:'SupplyPro', duration:'3 years', desc:'Built the backend for a supply chain visibility platform — route optimisation APIs and real-time ETD prediction.', tags:['Logistics','Supply Chain'] }], rating:'Meeting' },
  { code:'EMP1324', name:'Sabyasachi Kar', role:'Full-Stack Engineer', bu:'Digital Platform', location:'Noida', exp:4, status:'Bench', allocation:'Bench — available now', skills:['React','Node.js','MongoDB','TypeScript','Docker'], history:[{ project:'Content Management Platform', client:'MediaHouse', duration:'1.5 years', desc:'Full-stack development of a headless CMS platform — React editor, Node.js APIs, MongoDB document store.', tags:['Media','CMS'] }], rating:'Meeting' },
  { code:'EMP1325', name:'Satyam Prakash', role:'DevOps Engineer', bu:'Payments & FinTech', location:'Bengaluru', exp:4, status:'Bench', allocation:'Bench — available now', skills:['Docker','CI/CD','GitHub Actions','AWS','Kubernetes'], history:[{ project:'Payment Service CI/CD', client:'PayStack', duration:'1.5 years', desc:'Standardised CI/CD pipelines across 15 microservices in a payments platform — 3x faster release cycles.', tags:['Payments','DevOps','CI/CD'] }], rating:'Meeting' },
  { code:'EMP1326', name:'Saumyaranjan Das', role:'Data Engineer', bu:'Healthcare & Insurance', location:'Chennai', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Python','Spark','PostgreSQL','dbt','Airflow'], history:[{ project:'Claims Analytics Pipeline', client:'Meridian Health', duration:'2 years', desc:'Built a claims analytics pipeline that identified billing anomalies — surfaced $2M in potential over-billing for the client.', tags:['Healthcare','Analytics','Claims'] }], rating:'Exceeding' },
  { code:'EMP1327', name:'Saurabh Salame', role:'Backend Engineer', bu:'Digital Platform', location:'Bengaluru', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Go','gRPC','Redis','Kubernetes','Docker'], history:[{ project:'Real-Time Bidding Engine', client:'AdMatrix', duration:'2 years', desc:'Built a real-time bidding engine in Go — sub-10ms latency at 500K QPS using Redis for inventory caching.', tags:['AdTech','Real-Time','High Performance'] }], rating:'Exceeding' },
  { code:'EMP1328', name:'Saurav', role:'QA Automation Engineer', bu:'Digital Platform', location:'Bengaluru', exp:3, status:'Bench', allocation:'Bench — available now', skills:['Cypress','JavaScript','REST APIs','Jest','CI/CD'], history:[{ project:'E-Commerce QA Automation', client:'QuickShop', duration:'1.5 years', desc:'Built Cypress E2E test suites for a React e-commerce platform — reduced regression cycle from 3 days to 2 hours.', tags:['Retail','QA','E2E Testing'] }], rating:'Meeting' },
  { code:'EMP1329', name:'Sheelendra Singh', role:'Mobile Engineer', bu:'Digital Platform', location:'Delhi', exp:4, status:'Bench', allocation:'Bench — available now', skills:['Flutter','Dart','Firebase','REST APIs','Android'], history:[{ project:'Food Delivery App', client:'QuickEats', duration:'1.5 years', desc:'Built cross-platform Flutter food delivery app — real-time order tracking, in-app payments, and driver routing.', tags:['Consumer App','Mobile','Payments'] }], rating:'Meeting' },
  { code:'EMP1330', name:'Shyan Wasi', role:'Backend Engineer', bu:'Payments & FinTech', location:'Pune', exp:6, status:'Bench', allocation:'Bench — available now', skills:['Python','FastAPI','AWS','Payments APIs','Kafka'], history:[{ project:'Cross-Border Payments API', client:'TransferEdge', duration:'2.5 years', desc:'Built cross-border payments API handling FX conversion, SWIFT integration, and compliance checks for 20+ currencies.', tags:['Payments','Cross-Border','FinTech'] }], rating:'Exceeding' },
  { code:'EMP1331', name:'Swati Manikpure', role:'Platform Engineer', bu:'Digital Platform', location:'Hyderabad', exp:7, status:'Bench', allocation:'Bench — available now', skills:['Kubernetes','Helm','AWS','Terraform','ArgoCD'], history:[{ project:'Multi-Region Platform', client:'Scalix', duration:'3 years', desc:'Owned multi-region Kubernetes cluster setup with ArgoCD GitOps — 99.999% uptime across 4 regions.', tags:['Platform','Kubernetes','Multi-Region'] }], rating:'Exceeding' },
  { code:'EMP1332', name:'Varun Kulkarni', role:'Frontend Engineer', bu:'Payments & FinTech', location:'Pune', exp:4, status:'Bench', allocation:'Bench — available now', skills:['React','Redux','TypeScript','REST APIs','Jest'], history:[{ project:'Trading Platform UI', client:'StockEdge', duration:'1.5 years', desc:'Built the trading platform UI — real-time price feeds via WebSockets, complex order management forms, and P&L charts.', tags:['FinTech','Trading','Real-Time'] }], rating:'Meeting' },
  { code:'EMP1333', name:'Vinty Mittal', role:'Backend Engineer', bu:'Payments & FinTech', location:'Bengaluru', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Python','Payments APIs','Django','Kafka','PostgreSQL'], history:[{ project:'Issuer Processing System', client:'CardFirst', duration:'2 years', desc:'Built the card issuer processing system — authorization, clearing, and settlement for Visa and Mastercard transactions.', tags:['Payments','Card Processing','FinTech'] }], rating:'Exceeding' },
  { code:'EMP1334', name:'Harmanik Sethi', role:'Backend Engineer', bu:'Healthcare & Insurance', location:'Remote', exp:5, status:'Bench', allocation:'Bench — available now', skills:['C#','.NET','REST APIs','SQL Server','Docker'], history:[{ project:'Insurance Claims API', client:'SafeGuard Insurance', duration:'2 years', desc:'Built .NET microservices for claims adjudication — integrated with 3 legacy systems via adapter pattern.', tags:['Insurance','Claims','.NET'] }], rating:'Meeting' },
  { code:'EMP1335', name:'Anand Rathod', role:'Backend Engineer', bu:'Digital Platform', location:'Gurugram', exp:4, status:'Bench', allocation:'Bench — available now', skills:['Node.js','Express.js','MongoDB','Redis','Docker'], history:[{ project:'B2B SaaS API Platform', client:'WorkflowPro', duration:'1.5 years', desc:'Built multi-tenant B2B SaaS APIs — JWT-based tenant isolation, rate limiting, and usage metering.', tags:['SaaS','B2B','API'] }], rating:'Meeting' },
  { code:'EMP1336', name:'Rohit Saraswat', role:'Data Engineer', bu:'Digital Platform', location:'Bengaluru', exp:6, status:'Bench', allocation:'Bench — available now', skills:['Python','Airflow','Spark','GCP','BigQuery'], history:[{ project:'Marketing Attribution Pipeline', client:'GrowthLab', duration:'2.5 years', desc:'Designed multi-touch marketing attribution pipeline on GCP — ingested 1B+ user events, powered campaign ROI dashboards.', tags:['Marketing','Analytics','GCP'] }], rating:'Exceeding' },
  { code:'EMP1337', name:'Parvinder Singh', role:'Backend Engineer', bu:'Payments & FinTech', location:'Pune', exp:5, status:'Bench', allocation:'Bench — available now', skills:['Python','Django','REST APIs','Reconciliation','PostgreSQL'], history:[{ project:'Payout Reconciliation System', client:'SettlePay', duration:'2 years', desc:'Built the payout reconciliation system — automated daily ledger matching across 50+ payment instruments with exception handling.', tags:['Payments','Reconciliation','FinTech'] }], rating:'Exceeding' },
  { code:'EMP1338', name:'Ashish Kapoor', role:'Frontend Engineer', bu:'Healthcare & Insurance', location:'Chennai', exp:3, status:'Bench', allocation:'Bench — available now', skills:['React','Next.js','TypeScript','REST APIs','Tailwind CSS'], history:[{ project:'Telemedicine Patient App', client:'DocConnect', duration:'1 year', desc:'Built the patient-facing telemedicine app — video consultation scheduling, prescription download, and insurance verification UI.', tags:['Healthcare','Telemedicine'] }], rating:'Meeting' },
  { code:'EMP1339', name:'Jasmine Kaur', role:'Backend Engineer', bu:'Payments & FinTech', location:'Bengaluru', exp:6, status:'Bench', allocation:'Bench — available now', skills:['Java','Spring Boot','Kafka','Payments APIs','PostgreSQL'], history:[{ project:'Payment Switch System', client:'SwitchNet', duration:'3 years', desc:'Built the payment switching layer handling ISO 8583 message routing across banks — 10M daily transactions at 99.9% success rate.', tags:['Payments','Payment Switch','Banking'] }], rating:'Exceeding' },
  { code:'EMP1340', name:'Ritik Tripathi', role:'Full-Stack Engineer', bu:'Retail & eCommerce', location:'Noida', exp:4, status:'Bench', allocation:'Bench — available now', skills:['React','Python','FastAPI','PostgreSQL','Docker'], history:[{ project:'Inventory Management System', client:'RetailHub', duration:'1.5 years', desc:'Built inventory management system with real-time stock tracking — supplier portal, reorder automation, and warehouse integration.', tags:['Retail','Inventory','Supply Chain'] }], rating:'Meeting' },
  { code:'EMP1341', name:'Chetan Karale', role:'Platform Engineer', bu:'Digital Platform', location:'Chennai', exp:8, status:'Bench', allocation:'Bench — available now', skills:['AWS','CDK','Lambda','Terraform','Kubernetes'], history:[{ project:'Serverless Data Platform', client:'DataMesh', duration:'3 years', desc:'Architected a serverless data platform on AWS using Lambda, Step Functions, and CDK — 60% cost reduction vs. self-managed clusters.', tags:['Serverless','AWS','Data Platform'] }], rating:'Exceeding' },
];

const ALL_EMPLOYEES = [...NAMED_EMPLOYEES, ...GENERATED_EMPLOYEES];

// ─── Main seed function ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Seeding TalentLens AI database...');

  // Wipe in dependency order
  await prisma.notFitFeedback.deleteMany();
  await prisma.feedbackRound.deleteMany();
  await prisma.pipelineCandidate.deleteMany();
  await prisma.searchLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.irc.deleteMany();
  await prisma.project.deleteMany();
  await prisma.employeeRating.deleteMany();
  await prisma.employeeProject.deleteMany();
  await prisma.employeeSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  // 1. Skills
  for (const name of ALL_SKILLS) {
    await prisma.skill.create({ data: { name } });
  }
  const skillMap = Object.fromEntries(
    (await prisma.skill.findMany()).map((s: { name: string; id: number }) => [s.name, s.id]),
  );
  console.log(`  ✓ ${ALL_SKILLS.length} skills`);

  // 2. Employees
  const employeeMap: Record<string, number> = {};
  for (const e of ALL_EMPLOYEES) {
    const emp = await prisma.employee.create({
      data: {
        employeeCode: e.code,
        fullName: e.name,
        roleTitle: e.role,
        businessUnit: e.bu,
        location: e.location,
        experienceYears: e.exp,
        benchStatus: e.status,
        currentAllocation: e.allocation ?? (e.status === 'Bench' ? 'Bench — available now' : null),
        availableDate: e.available ? new Date(e.available) : null,
        joiningNotice: e.notice ?? 'No constraint',
      },
    });
    employeeMap[e.code] = emp.id;

    // Skills
    for (const skillName of e.skills) {
      if (skillMap[skillName]) {
        await prisma.employeeSkill.create({
          data: { employeeId: emp.id, skillId: skillMap[skillName] },
        });
      }
    }

    // Project history
    for (const h of e.history) {
      await prisma.employeeProject.create({
        data: {
          employeeId: emp.id,
          projectName: h.project,
          clientName: h.client,
          duration: h.duration,
          description: h.desc,
          domainTags: h.tags,
        },
      });
    }

    // Rating
    if (e.rating) {
      await prisma.employeeRating.create({
        data: { employeeId: emp.id, reviewCycle: 'H1 2026', rating: e.rating },
      });
    }
  }
  console.log(`  ✓ ${ALL_EMPLOYEES.length} employees`);

  // 3. Users — password: demo1234
  const passwordHash = await bcrypt.hash('demo1234', 12);

  const shilpi = await prisma.user.create({
    data: { name: 'Shilpi Mittal', email: 'shilpi.mittal@globallogic.com', passwordHash, role: 'manager', title: 'Delivery Manager · Bengaluru' },
  });
  await prisma.user.create({
    data: { name: 'Malleswari Arun', email: 'malleswari.arun2@globallogic.com', passwordHash, role: 'hr', title: 'Head of Resourcing · Gurugram' },
  });
  const satyaUser = await prisma.user.create({
    data: { name: 'Satya Mishra', email: 'satya.mishra@globallogic.com', passwordHash, role: 'candidate', title: 'Senior Software Engineer', employeeId: employeeMap['EMP1042'] },
  });
  const nitin = await prisma.user.create({
    data: { name: 'Nitin Sharma', email: 'nitin.sharma13@globallogic.com', passwordHash, role: 'manager', title: 'Delivery Manager · Hyderabad' },
  });
  console.log('  ✓ 4 users');

  // 4. Projects
  const proj1 = await prisma.project.create({ data: { name: 'Payments Platform — Phase 2', customer: 'Northwind Financial', managerId: shilpi.id, status: 'Active', startDate: new Date('2025-10-01'), tags: ['Payments', 'FinTech'] } });
  const proj2 = await prisma.project.create({ data: { name: 'Claims Automation Revamp', customer: 'Meridian Health', managerId: shilpi.id, status: 'Active', startDate: new Date('2025-12-01'), tags: ['Healthcare', 'Automation'] } });
  const proj3 = await prisma.project.create({ data: { name: 'Logistics Tracker API', customer: 'Atlas Freight', managerId: nitin.id, status: 'Active', startDate: new Date('2026-01-15'), tags: ['Logistics'] } });
  const proj4 = await prisma.project.create({ data: { name: 'Retail Loyalty Engine', customer: 'Corestone Retail', managerId: nitin.id, status: 'On hold', startDate: new Date('2026-03-01'), tags: ['Retail', 'Loyalty'] } });
  console.log('  ✓ 4 projects');

  // 5. IRCs
  const irc1 = await prisma.irc.create({ data: { ircCode: 'IRC104521', projectId: proj1.id, roleTitle: 'Senior Python Engineer', mandatorySkills: 'Python, Payments APIs', preferredSkills: 'Django, Kafka', experienceRange: '4-7 yrs', location: 'Pune', remotePolicy: 'Hybrid', openingDate: new Date('2026-07-01'), status: 'Open' } });
  await prisma.irc.create({ data: { ircCode: 'IRC104589', projectId: proj1.id, roleTitle: 'DevOps Engineer', mandatorySkills: 'Kubernetes, AWS', preferredSkills: 'Terraform', experienceRange: '4-7 yrs', location: 'Bengaluru', remotePolicy: 'Remote friendly', openingDate: new Date('2026-07-10'), status: 'Open' } });
  await prisma.irc.create({ data: { ircCode: 'IRC208833', projectId: proj2.id, roleTitle: 'Backend Engineer', mandatorySkills: 'Python, Kubernetes', preferredSkills: 'AWS', experienceRange: '4-7 yrs', location: 'Noida', remotePolicy: 'Hybrid', openingDate: new Date('2026-07-15'), status: 'Open' } });
  await prisma.irc.create({ data: { ircCode: 'IRC311290', projectId: proj3.id, roleTitle: 'QA Automation Engineer', mandatorySkills: 'Python, Selenium', preferredSkills: 'CI/CD', experienceRange: '2-4 yrs', location: 'Chennai', remotePolicy: 'Onsite only', openingDate: new Date('2026-07-20'), status: 'Open' } });
  await prisma.irc.create({ data: { ircCode: 'IRC417765', projectId: proj4.id, roleTitle: 'Backend Engineer', mandatorySkills: 'Java, Spring', preferredSkills: 'Python', experienceRange: '4-7 yrs', location: 'Hyderabad', remotePolicy: 'Hybrid', openingDate: new Date('2026-07-25'), status: 'Open' } });
  console.log('  ✓ 5 IRCs');

  // 6. Initial pipeline entries for IRC104521
  const pc1 = await prisma.pipelineCandidate.create({
    data: { employeeId: employeeMap['EMP1042'], ircId: irc1.id, stage: 'Screening', matchPct: 92, whyRecommend: 'Spent 8 months owning reconciliation and settlement flows for a fintech payments integration — directly relevant project evidence.', whyNot: ['Currently allocated until 2 Sep 2026 — 1-day availability gap'], conflict: true, conflictNote: 'Available 2 Sep 2026; role needs joining by 1 Sep — 1-day gap' },
  });
  const pc2 = await prisma.pipelineCandidate.create({
    data: { employeeId: employeeMap['EMP1088'], ircId: irc1.id, stage: 'AI Shortlisted', matchPct: 78, whyRecommend: 'Built a high-transaction-volume claims backend — strong backend systems evidence transferable to payments.', whyNot: ['No direct payments domain experience', 'PostgreSQL proficient but no Kafka experience'] },
  });
  await prisma.pipelineCandidate.create({
    data: { employeeId: employeeMap['EMP1121'], ircId: irc1.id, stage: 'AI Shortlisted', matchPct: 71, whyRecommend: 'Led the reporting module of a merchant-facing payments dashboard for 2 years — frontend-heavy but with payments context.', whyNot: ['Full-stack profile; IRC needs Python backend specialist', 'No Payments API development experience listed'] },
  });
  console.log('  ✓ 3 pipeline entries');

  // 7. Feedback round for Satya's pipeline entry
  await prisma.feedbackRound.create({
    data: { pipelineCandidateId: pc1.id, roundName: 'Screening', interviewer: 'Shilpi Mittal', roundDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), rating: 'Strong yes', comments: 'Great domain knowledge on payments reconciliation. Strong communicator. Recommend advancing to tech evaluation.' },
  });
  console.log('  ✓ 1 feedback round');

  // 8. Notifications for Prince Verma
  await prisma.notification.createMany({
    data: [
      { userId: shilpi.id, title: 'Satya Mishra moved to Screening', description: 'IRC104521 · Payments Platform Phase 2', seen: false },
      { userId: shilpi.id, title: 'New application: Prince Verma for IRC104521', description: 'Prince Verma applied to Senior Python Engineer', seen: false },
      { userId: satyaUser.id, title: 'Your screening is confirmed', description: 'Screening for IRC104521 is scheduled', seen: false },
    ],
  });
  console.log('  ✓ 3 notifications');

  console.log('\n✅ Seed complete — 49 employees, 4 projects, 5 IRCs, 3 pipeline entries ready.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
