/**
 * Campus Voice Connect - Classroom & Campus Database
 */

export const campusClassrooms = [
  {
    id: 'ECE-301',
    name: 'Classroom ECE-301',
    block: 'Block B (Academic)',
    floor: '3rd Floor',
    department: 'Electronics & Communication',
    course: 'EC602 - Signals & Digital Systems',
    occupancy: 62,
    capacity: 70,
    speakerStatus: 'online', // 'online' | 'busy' | 'offline'
    speakerDevice: 'Bose Professional Campus PoE IP Speaker #B3-01',
    activeFaculty: 'Dr. Divakar Verma (Cabin 204)',
    signal: 'Strong (5 GHz Wi-Fi 6)',
    latency: '11 ms',
    smartBoard: true,
    lastBroadcast: '10 mins ago',
    coordinates: { x: 35, y: 30 }
  },
  {
    id: 'ECE-302',
    name: 'VLSI Design Lab (ECE-302)',
    block: 'Block B (Academic)',
    floor: '3rd Floor',
    department: 'Electronics & Communication',
    course: 'EC604 - CMOS & VLSI Systems',
    occupancy: 45,
    capacity: 50,
    speakerStatus: 'online',
    speakerDevice: 'Campus PoE IP Horn Speaker #B3-02',
    activeFaculty: null,
    signal: 'Strong',
    latency: '14 ms',
    smartBoard: true,
    lastBroadcast: '1 hour ago',
    coordinates: { x: 55, y: 30 }
  },
  {
    id: 'CS-104',
    name: 'Lecture Hall CS-104',
    block: 'Block A (Computing)',
    floor: '1st Floor',
    department: 'Computer Science & Engineering',
    course: 'CS301 - Design & Analysis of Algorithms',
    occupancy: 84,
    capacity: 90,
    speakerStatus: 'online',
    speakerDevice: 'JBL Pro Ceiling Array #A1-04',
    activeFaculty: 'Prof. Ramesh Gupta (Cabin 108)',
    signal: 'Strong',
    latency: '9 ms',
    smartBoard: true,
    lastBroadcast: '25 mins ago',
    coordinates: { x: 25, y: 65 }
  },
  {
    id: 'CS-202',
    name: 'Classroom CS-202',
    block: 'Block A (Computing)',
    floor: '2nd Floor',
    department: 'Computer Science & Engineering',
    course: 'CS402 - Computer Networks',
    occupancy: 68,
    capacity: 75,
    speakerStatus: 'online',
    speakerDevice: 'Yamaha Campus Smart Soundbar #A2-02',
    activeFaculty: null,
    signal: 'Strong',
    latency: '12 ms',
    smartBoard: false,
    lastBroadcast: '3 hours ago',
    coordinates: { x: 45, y: 65 }
  },
  {
    id: 'SEMINAR-HALL-2',
    name: 'Central Seminar Hall 2',
    block: 'Block B (Academic)',
    floor: '1st Floor',
    department: 'All Departments / Campus Auditorium',
    course: 'Campus Technical Symposium & Guest Lectures',
    occupancy: 135,
    capacity: 150,
    speakerStatus: 'online',
    speakerDevice: 'Auditorium PA Line Array #B1-SH2',
    activeFaculty: null,
    signal: 'Strong',
    latency: '8 ms',
    smartBoard: true,
    lastBroadcast: 'Yesterday',
    coordinates: { x: 75, y: 30 }
  },
  {
    id: 'IOT-LAB',
    name: 'IoT & Embedded Systems Lab',
    block: 'Block D (Research Wing)',
    floor: '2nd Floor',
    department: 'Electronics & Communication',
    course: 'EC705 - Microcontrollers & Edge AI',
    occupancy: 38,
    capacity: 40,
    speakerStatus: 'online',
    speakerDevice: 'Shure Microflex Speaker Hub #D2-IOT',
    activeFaculty: null,
    signal: 'Moderate',
    latency: '18 ms',
    smartBoard: true,
    lastBroadcast: '4 hours ago',
    coordinates: { x: 65, y: 80 }
  },
  {
    id: 'MECH-201',
    name: 'Classroom MECH-201',
    block: 'Block C (Engineering)',
    floor: '2nd Floor',
    department: 'Mechanical Engineering',
    course: 'ME401 - Fluid Dynamics & Thermodynamics',
    occupancy: 52,
    capacity: 60,
    speakerStatus: 'online',
    speakerDevice: 'Campus PoE IP Speaker #C2-01',
    activeFaculty: null,
    signal: 'Strong',
    latency: '15 ms',
    smartBoard: false,
    lastBroadcast: 'Yesterday',
    coordinates: { x: 80, y: 70 }
  }
];

export const initialBroadcastHistory = [
  {
    id: 'hist-101',
    timestamp: 'Today, 11:30 AM',
    faculty: 'Dr. Divakar Verma',
    cabin: 'Cabin 204',
    department: 'ECE',
    classroom: 'ECE-301',
    classroomName: 'Classroom ECE-301',
    duration: '00:24',
    durationSec: 24,
    type: 'Urgent Notice',
    transcript: 'Good morning students, please come to the seminar hall at 2 PM for the guest lecture.',
    recipients: 62,
    status: 'Delivered',
    starred: true
  },
  {
    id: 'hist-102',
    timestamp: 'Today, 09:15 AM',
    faculty: 'Dr. Divakar Verma',
    cabin: 'Cabin 204',
    department: 'ECE',
    classroom: 'ECE-302',
    classroomName: 'VLSI Design Lab',
    duration: '00:41',
    durationSec: 41,
    type: 'Lab Instruction',
    transcript: 'Students in VLSI Lab, please turn on Cadence Virtuoso license server 3. Session starts in 5 minutes.',
    recipients: 45,
    status: 'Delivered',
    starred: false
  },
  {
    id: 'hist-103',
    timestamp: 'Yesterday, 03:45 PM',
    faculty: 'Dr. Divakar Verma',
    cabin: 'Cabin 204',
    department: 'ECE',
    classroom: 'ECE-301',
    classroomName: 'Classroom ECE-301',
    duration: '00:32',
    durationSec: 32,
    type: 'Assignment Notice',
    transcript: 'Kindly submit your DSP assignments at Cabin 204 before 5 PM today without fail.',
    recipients: 60,
    status: 'Delivered',
    starred: true
  },
  {
    id: 'hist-104',
    timestamp: 'Yesterday, 11:00 AM',
    faculty: 'Prof. Ramesh Gupta',
    cabin: 'Cabin 108',
    department: 'CSE',
    classroom: 'CS-104',
    classroomName: 'Lecture Hall CS-104',
    duration: '00:18',
    durationSec: 18,
    type: 'Class Rescheduled',
    transcript: 'Algorithms class will be held in Seminar Hall 2 due to projector maintenance in CS-104.',
    recipients: 84,
    status: 'Delivered',
    starred: false
  }
];

export const quickPresets = [
  {
    id: 'p1',
    title: 'Seminar Hall Assembly',
    text: 'Good morning students, please come to the seminar hall at 2 PM.',
    category: 'Urgent'
  },
  {
    id: 'p2',
    title: 'Class Postponed (15m)',
    text: 'Attention students: class will start 15 minutes late due to an emergency HOD meeting.',
    category: 'Schedule'
  },
  {
    id: 'p3',
    title: 'Assignment Submission',
    text: 'Please have the class representative collect assignments and bring them to Cabin 204.',
    category: 'Academic'
  },
  {
    id: 'p4',
    title: 'Lab Session Venue',
    text: 'Today’s practical session will be conducted in the IoT Lab instead of Room 301.',
    category: 'Venue'
  },
  {
    id: 'p5',
    title: 'Quiet / Class in Session',
    text: 'Please maintain discipline inside the hall. I will join you in 10 minutes.',
    category: 'Instruction'
  }
];
