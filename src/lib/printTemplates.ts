// Shapes and defaults for configurable print templates.
// Stored as JSON in PrintTemplate.config, parsed on read, validated on write.

export type TemplateType = 'STUDENT_ID' | 'TEACHER_ID' | 'ADMIT_CARD' | 'REPORT_CARD';

// Shared header config (logo + lines + colors)
export interface TemplateHeader {
  logoUrl?: string;
  primaryColor: string;        // hex e.g. #006400 — used for header bar / accents
  textColor?: string;          // hex e.g. #ffffff — header text
  headerLine1: string;         // school name
  headerLine2?: string;        // address line
  headerLine3?: string;        // reg / phone
}

export type IdLayout = 'photo-left' | 'photo-right' | 'photo-top' | 'compact';
export type IdOrientation = 'portrait' | 'landscape';

export interface IdCardConfig extends TemplateHeader {
  fields: string[];            // which fields to show — order matters; rendered top-to-bottom
  showQR: boolean;
  showPhoto: boolean;
  showSession: boolean;
  footer: string;
  validityText?: string;       // e.g. "Valid till March 2027"
  cardLabel: string;           // e.g. "Student ID Card" / "Staff ID Card"

  // Layout
  orientation: IdOrientation;  // portrait or landscape
  layout: IdLayout;            // where the photo sits relative to fields

  // Back side (optional). When backEnabled, the maker prints TWO cards per
  // record — front and back — paired together on the same sheet.
  backEnabled: boolean;
  backText: string;            // multi-line — terms / lost-and-found / signature box
  backShowContactInfo: boolean; // show school phone/address line on back
}

export interface AdmitCardConfig extends TemplateHeader {
  cardLabel: string;           // e.g. "ADMIT CARD"
  showPhoto: boolean;
  showQR: boolean;
  fields: string[];            // student, exam, examFee, dob, etc.
  examInstructions: string;    // multi-line
  footer: string;
  signatureLabels: string[];   // e.g. ["Class Teacher","Principal"]
}

export interface ReportCardConfig extends TemplateHeader {
  cardLabel: string;           // e.g. "REPORT CARD FOR ACADEMIC SESSION"
  studentFields: string[];     // which student fields to print at top
  showDiscipline: boolean;
  showRemarks: boolean;
  remarksDefault: string;      // e.g. "Congratulations and best of luck for the next session."
  footer: string;
  signatureLabels: string[];   // e.g. ["Class Teacher","Principal","Parent"]
}

export type TemplateConfig = IdCardConfig | AdmitCardConfig | ReportCardConfig;

// Available fields by template type — used by the editor's checkbox list.
// The keys map to runtime values pulled from the relevant record.
export const availableFields: Record<TemplateType, { key: string; label: string }[]> = {
  STUDENT_ID: [
    { key: 'name', label: 'Full Name' },
    { key: 'class', label: 'Class' },
    { key: 'section', label: 'Section' },
    { key: 'admissionNo', label: 'Admission No' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'fatherName', label: "Father's Name" },
    { key: 'motherName', label: "Mother's Name" },
    { key: 'guardianName', label: "Guardian's Name" },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'bloodGroup', label: 'Blood Group' },
    { key: 'dob', label: 'Date of Birth' },
  ],
  TEACHER_ID: [
    { key: 'name', label: 'Full Name' },
    { key: 'designation', label: 'Designation' },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'subjects', label: 'Subjects' },
    { key: 'phone', label: 'Phone' },
    { key: 'qualification', label: 'Qualification' },
    { key: 'bloodGroup', label: 'Blood Group' },
    { key: 'dob', label: 'Date of Birth' },
  ],
  ADMIT_CARD: [
    { key: 'name', label: 'Full Name' },
    { key: 'class', label: 'Class' },
    { key: 'section', label: 'Section' },
    { key: 'admissionNo', label: 'Admission No' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'fatherName', label: "Father's Name" },
    { key: 'examName', label: 'Exam Name' },
    { key: 'examDates', label: 'Exam Dates' },
    { key: 'examCenter', label: 'Exam Center' },
    { key: 'subjects', label: 'Subjects (with timetable)' },
  ],
  REPORT_CARD: [
    { key: 'name', label: 'Full Name' },
    { key: 'class', label: 'Class' },
    { key: 'admissionNo', label: 'Admission No' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'fatherName', label: "Father's Name" },
    { key: 'motherName', label: "Mother's Name" },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'address', label: 'Address' },
  ],
};

// Default templates — used as starter when admin clicks "New" or as fallback
// when a maker is invoked but no default template exists.
export function defaultConfig(type: TemplateType): TemplateConfig {
  const sharedHeader = {
    primaryColor: '#006400',
    textColor: '#ffffff',
    headerLine1: 'PATHAK EDUCATIONAL FOUNDATION SCHOOL',
    headerLine2: 'Salarpur, Sector - 101',
    headerLine3: 'Reg: NCER/90001255',
  };

  switch (type) {
    case 'STUDENT_ID':
      return {
        ...sharedHeader,
        cardLabel: 'Student ID Card',
        fields: ['name', 'class', 'section', 'admissionNo', 'fatherName'],
        showQR: true,
        showPhoto: true,
        showSession: true,
        footer: 'Scan for attendance',
        orientation: 'portrait',
        layout: 'photo-left',
        backEnabled: false,
        backText: 'If found, please return to the school office.\n\nValid only for the current academic session.',
        backShowContactInfo: true,
      };
    case 'TEACHER_ID':
      return {
        ...sharedHeader,
        cardLabel: 'Staff ID Card',
        fields: ['name', 'designation', 'employeeId', 'phone'],
        showQR: true,
        showPhoto: true,
        showSession: true,
        footer: 'Scan for attendance',
        orientation: 'portrait',
        layout: 'photo-left',
        backEnabled: false,
        backText: 'If found, please return to the school office.',
        backShowContactInfo: true,
      };
    case 'ADMIT_CARD':
      return {
        ...sharedHeader,
        cardLabel: 'ADMIT CARD',
        showPhoto: true,
        showQR: false,
        fields: ['name', 'class', 'section', 'admissionNo', 'rollNumber', 'examName', 'examDates', 'subjects'],
        examInstructions: '1. Reach the exam hall 15 minutes before time.\n2. Carry this admit card and a valid ID.\n3. Mobile phones / electronic devices are prohibited.',
        footer: 'Best of luck.',
        signatureLabels: ['Class Teacher', 'Principal'],
      };
    case 'REPORT_CARD':
      return {
        ...sharedHeader,
        cardLabel: 'REPORT CARD FOR ACADEMIC SESSION',
        studentFields: ['name', 'class', 'admissionNo', 'fatherName', 'motherName', 'dob', 'address'],
        showDiscipline: true,
        showRemarks: true,
        remarksDefault: 'Congratulations and best of luck for the next session.',
        footer: '',
        signatureLabels: ['Class Teacher', 'Principal', 'Parent'],
      };
  }
}

export function isValidType(t: any): t is TemplateType {
  return t === 'STUDENT_ID' || t === 'TEACHER_ID' || t === 'ADMIT_CARD' || t === 'REPORT_CARD';
}

// Parse a stored config blob safely — returns defaults on error.
export function parseConfig(type: TemplateType, raw: string | null | undefined): TemplateConfig {
  if (!raw) return defaultConfig(type);
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultConfig(type), ...parsed } as TemplateConfig;
  } catch {
    return defaultConfig(type);
  }
}
