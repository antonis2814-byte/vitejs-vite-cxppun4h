import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

interface Ride {
  id: number;
  origin: string;
  destination: string;
  ride_date: string;
  seats: number;
  price: number;
  driver_name: string;
  user_id?: string;
  driver_phone?: string;
  driver_plate?: string;
}

const CORRIDORS: { cities: { name: string; minsFromStart: number }[] }[] = [
  {
    cities: [
      { name: 'θεσσαλονικη', minsFromStart: 0 },
      { name: 'κατερινη', minsFromStart: 50 },
      { name: 'λαρισα', minsFromStart: 105 },
      { name: 'βολος', minsFromStart: 140 },
      { name: 'λαμια', minsFromStart: 195 },
      { name: 'θηβα', minsFromStart: 260 },
      { name: 'χαλκιδα', minsFromStart: 270 },
      { name: 'αθηνα', minsFromStart: 315 },
    ],
  },
  {
    cities: [
      { name: 'ηγουμενιτσα', minsFromStart: 0 },
      { name: 'ιωαννινα', minsFromStart: 55 },
      { name: 'μετσοβο', minsFromStart: 90 },
      { name: 'γρεβενα', minsFromStart: 125 },
      { name: 'κοζανη', minsFromStart: 155 },
      { name: 'βεροια', minsFromStart: 195 },
      { name: 'θεσσαλονικη', minsFromStart: 245 },
      { name: 'καβαλα', minsFromStart: 345 },
      { name: 'ξανθη', minsFromStart: 395 },
      { name: 'κομοτηνη', minsFromStart: 430 },
      { name: 'αλεξανδρουπολη', minsFromStart: 475 },
    ],
  },
  {
    cities: [
      { name: 'ιωαννινα', minsFromStart: 0 },
      { name: 'αρτα', minsFromStart: 50 },
      { name: 'αγρινιο', minsFromStart: 100 },
      { name: 'μεσολογγι', minsFromStart: 120 },
      { name: 'πατρα', minsFromStart: 160 },
      { name: 'αιγιο', minsFromStart: 190 },
      { name: 'κιατο', minsFromStart: 230 },
      { name: 'κορινθος', minsFromStart: 250 },
      { name: 'αθηνα', minsFromStart: 310 },
    ],
  },
  {
    cities: [
      { name: 'αθηνα', minsFromStart: 0 },
      { name: 'κορινθος', minsFromStart: 60 },
      { name: 'τριπολη', minsFromStart: 115 },
      { name: 'σπαρτη', minsFromStart: 160 },
      { name: 'καλαματα', minsFromStart: 175 },
    ],
  },
  {
    cities: [
      { name: 'χανια', minsFromStart: 0 },
      { name: 'ρεθυμνο', minsFromStart: 65 },
      { name: 'ηρακλειο', minsFromStart: 130 },
      { name: 'αγιος νικολαος', minsFromStart: 180 },
    ],
  },
];

function normalizeGreek(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function addMinutesToTime(timeStr: string, minsToAdd: number): string {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '';
  let hours = parseInt(match[1], 10);
  let mins = parseInt(match[2], 10) + minsToAdd;
  hours = (hours + Math.floor(mins / 60)) % 24;
  mins = mins % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function getDateDiffInDays(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function checkRouteMatch(ride: Ride, searchOrig: string, searchDest: string, searchDate: string) {
  const rOrig = normalizeGreek(ride.origin);
  const rDest = normalizeGreek(ride.destination);
  const sOrig = normalizeGreek(searchOrig);
  const sDest = normalizeGreek(searchDest);

  const rideDateOnly = ride.ride_date.substring(0, 10);
  let dateCategory: 'exact' | 'flexible' | null = 'exact';
  let dayDiff = 0;

  if (searchDate) {
    dayDiff = getDateDiffInDays(rideDateOnly, searchDate);
    const absDiff = Math.abs(dayDiff);
    if (absDiff === 0) {
      dateCategory = 'exact';
    } else if (absDiff <= 3) {
      dateCategory = 'flexible';
    } else {
      return { matched: false, stopInfo: null, calculatedPrice: ride.price, dateCategory: null, dayDiff: 0 };
    }
  }

  const directOrig = !sOrig || rOrig.includes(sOrig);
  const directDest = !sDest || rDest.includes(sDest);
  if (directOrig && directDest) {
    return { matched: true, stopInfo: null, calculatedPrice: ride.price, dateCategory, dayDiff };
  }

  for (const corridor of CORRIDORS) {
    const idxRideOrig = corridor.cities.findIndex((c) => rOrig.includes(c.name));
    const idxRideDest = corridor.cities.findIndex((c) => rDest.includes(c.name));

    if (idxRideOrig !== -1 && idxRideDest !== -1 && idxRideOrig !== idxRideDest) {
      const isForward = idxRideOrig < idxRideDest;
      const idxSearchOrig = sOrig ? corridor.cities.findIndex((c) => c.name.includes(sOrig)) : idxRideOrig;
      const idxSearchDest = sDest ? corridor.cities.findIndex((c) => c.name.includes(sDest)) : idxRideDest;

      if (idxSearchOrig !== -1 && idxSearchDest !== -1) {
        const validOrder = isForward
          ? idxSearchOrig >= idxRideOrig && idxSearchDest <= idxRideDest && idxSearchOrig < idxSearchDest
          : idxSearchOrig <= idxRideOrig && idxSearchDest >= idxRideDest && idxSearchOrig > idxSearchDest;

        if (validOrder) {
          const startMins = corridor.cities[idxSearchOrig].minsFromStart;
          const endMins = corridor.cities[idxSearchDest].minsFromStart;
          const segmentMins = Math.abs(endMins - startMins);
          const totalRideMins = Math.abs(corridor.cities[idxRideDest].minsFromStart - corridor.cities[idxRideOrig].minsFromStart);
          
          let calculatedPrice = ride.price;
          if (totalRideMins > 0) {
            calculatedPrice = Math.round((ride.price * (segmentMins / totalRideMins)) * 100) / 100;
            if (calculatedPrice < 1) calculatedPrice = 1;
          }

          const minsFromRideStart = Math.abs(startMins - corridor.cities[idxRideOrig].minsFromStart);
          const timeMatch = ride.ride_date.match(/Αναχώρηση:\s*(\d{2}:\d{2})/);
          const baseTime = timeMatch ? timeMatch[1] : '00:00';
          const estimatedTime = addMinutesToTime(baseTime, minsFromRideStart);
          const cityLabel = corridor.cities[idxSearchOrig].name.toUpperCase();

          return {
            matched: true,
            stopInfo: minsFromRideStart > 0 ? `Διέλευση από ${cityLabel} περίπου στις ${estimatedTime}` : null,
            calculatedPrice,
            dateCategory,
            dayDiff,
          };
        }
      }
    }
  }

  return { matched: false, stopInfo: null, calculatedPrice: ride.price, dateCategory: null, dayDiff: 0 };
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'passenger' | 'driver' | 'profile'>('passenger');

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [rideDate, setRideDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [seats, setSeats] = useState('');
  const [price, setPrice] = useState('');

  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDest, setSearchDest] = useState('');
  const [searchDate, setSearchDate] = useState('');

  // Στοιχεία Προφίλ (Τηλέφωνο, Πινακίδα, Κάρτα)
  const [phone, setPhone] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchRides();
        const meta = session.user.user_metadata;
        if (meta?.saved_card) setCardNumber(meta.saved_card);
        if (meta?.phone) setPhone(meta.phone);
        if (meta?.car_plate) setCarPlate(meta.car_plate);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchRides();
        const meta = session.user.user_metadata;
        if (meta?.saved_card) setCardNumber(meta.saved_card);
        if (meta?.phone) setPhone(meta.phone);
        if (meta?.car_plate) setCarPlate(meta.car_plate);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        alert('Ο λογαριασμός δημιουργήθηκε! Καλώς ήρθατε.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      alert('Σφάλμα: ' + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function fetchRides() {
    try {
      const { data, error } = await supabase.from('rides').select('*').order('ride_date', { ascending: true });
      if (error) throw error;
      if (data) setRides(data);
    } catch (error) {
      console.error('Σφάλμα φόρτωσης:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRide(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;

    const meta = session.user.user_metadata;
    const driverPhone = meta?.phone || phone;
    const driverPlate = meta?.car_plate || carPlate;

    if (!driverPhone || !driverPlate) {
      alert('⚠️ Παρακαλώ συμπληρώστε πρώτα το Τηλέφωνο και τον Αριθμό Πινακίδας στην καρτέλα "👤 Προφίλ" πριν δημοσιεύσετε διαδρομή!');
      setActiveTab('profile');
      return;
    }

    const userName = meta?.full_name || session.user.email;

    try {
      const formattedDateTime = `${rideDate} (Αναχώρηση: ${departureTime})`;
      const { error } = await supabase.from('rides'].insert([
        {
          origin,
          destination,
          ride_date: formattedDateTime,
          seats: parseInt(seats) || 1,
          price: parseFloat(price) || 0,
          driver_name: `${userName} | Άφιξη: ${arrivalTime || 'N/A'}`,
          user_id: session.user.id,
          driver_phone: driverPhone,
          driver_plate: driverPlate,
        },
      ]);

      if (error) throw error;

      setOrigin('');
      setDestination('');
      setRideDate('');
      setDepartureTime('');
      setArrivalTime('');
      setSeats('');
      setPrice('');
      fetchRides();
      alert('Το δρομολόγιο δημοσιεύτηκε επιτυχώς!');
      setActiveTab('passenger');
    } catch (error: any) {
      alert('Σφάλμα: ' + error.message);
    }
  }

  async function handleDeleteRide(id: number) {
    if (!confirm('Είστε σίγουρος ότι θέλετε να διαγράψετε αυτή τη διαδρομή;')) return;
    try {
      const { error } = await supabase.from('rides').delete().eq('id', id);
      if (error) throw error;
      setRides(rides.filter((r) => r.id !== id));
    } catch (error: any) {
      alert('Σφάλμα διαγραφής: ' + error.message);
    }
  }

  // Αποθήκευση στο Προφίλ (Τηλέφωνο, Πινακίδα, Κάρτα)
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          saved_card: cardNumber,
          phone: phone,
          car_plate: carPlate
        }
      });
      if (error) throw error;
      alert('✅ Το προφίλ σας (τηλέφωνο, πινακίδα, κάρτα) αποθηκεύτηκε με επιτυχία!');
    } catch (error: any) {
      alert('Σφάλμα αποθήκευσης προφίλ: ' + error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  // Κράτηση Θέσης & Γνωστοποίηση Στοιχείων Οδηγού στον Επιβάτη
  async function handleBookRide(ride: Ride, finalPrice: number) {
    const meta = session.user.user_metadata;
    const savedCard = meta?.saved_card || cardNumber;

    if (!savedCard) {
      alert('⚠️ Δεν έχετε αποθηκεύσει κάρτα στο προφίλ σας! Πηγαίνετε στην καρτέλα "👤 Προφίλ".');
      setActiveTab('profile');
      return;
    }

    if (ride.seats <= 1) {
      alert('Δυστυχώς δεν υπάρχουν άλλες διαθέσιμες θέσεις.');
      return;
    }

    if (!confirm(`Επιβεβαίωση κράτησης με χρέωση ${finalPrice}€ στην κάρτα σας?`)) return;

    try {
      const updatedSeats = ride.seats - 1;
      const { error } = await supabase
        .from('rides')
        .update({ seats: updatedSeats })
        .eq('id', ride.id);

      if (error) throw error;

      // Εμφάνιση Στοιχείων Οδηγού εφόσον έγινε η κράτηση
      alert(`🎉 Η κράτηση ολοκληρώθηκε επιτυχώς! Η κάρτα σας χρεώθηκε ${finalPrice}€.\n\n📞 ΣΤΟΙΧΕΙΑ ΕΠΙΚΟΙΝΩΝΙΑΣ ΟΔΗΓΟΥ:\n• Τηλέφωνο: ${ride.driver_phone || 'Διαθέσιμο σύντομα'}\n• Πινακίδα Οχήματος: ${ride.driver_plate || 'N/A'}`);
      
      fetchRides();
    } catch (error: any) {
      alert('Σφάλμα κράτησης: ' + error.message);
    }
  }

  if (!session) {
    return (
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', background: 'white', padding: '30px 24px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#1e293b', fontWeight: '800' }}>🚗 Autostop</h1>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#64748b' }}>
              Η έξυπνη πλατφόρμα carpooling
            </p>
          </div>

          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
            <button type="button" onClick={() => setAuthMode('login')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: authMode === 'login' ? 'white' : 'transparent', fontWeight: '700', color: authMode === 'login' ? '#0f172a' : '#64748b', cursor: 'pointer' }}>
              Σύνδεση
            </button>
            <button type="button" onClick={() => setAuthMode('signup')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: authMode === 'signup' ? 'white' : 'transparent', fontWeight: '700', color: authMode === 'signup' ? '#0f172a' : '#64748b', cursor: 'pointer' }}>
              Εγγραφή
            </button>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'grid', gap: '14px' }}>
            {authMode === 'signup' && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>ΟΝΟΜΑΤΕΠΩΝΥΜΟ</label>
                <input type="text" placeholder="π.χ. Αντώνης Παπαδόπουλος" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>EMAIL</label>
              <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>ΚΩΔΙΚΟΣ (τουλάχιστον 6 χαρακτήρες)</label>
              <input type="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={authLoading} style={{ background: '#2563eb', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginTop: '6px' }}>
              {authLoading ? 'Παρακαλώ περιμένετε...' : authMode === 'login' ? 'Είσοδος στην Εφαρμογή' : 'Δημιουργία Λογαριασμού'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const currentUserName = session.user.user_metadata?.full_name || session.user.email;
  const meta = session.user.user_metadata;
  const isProfileComplete = !!(meta?.phone && meta?.car_plate && meta?.saved_card);

  const processedRides = rides
    .map((ride) => ({
      ride,
      result: checkRouteMatch(ride, searchOrigin, searchDest, searchDate),
    }))
    .filter((item) => item.result.matched);

  processedRides.sort((a, b) => {
    if (a.result.dateCategory === 'exact' && b.result.dateCategory !== 'exact') return -1;
    if (a.result.dateCategory !== 'exact' && b.result.dateCategory === 'exact') return 1;
    return 0;
  });

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f1f5f9', minHeight: '100vh', paddingBottom: '40px' }}>
      <header style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>🚗 Autostop</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>Γεια σου, <strong>{currentUserName}</strong></p>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Έξοδος
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '650px', margin: '20px auto', padding: '0 15px' }}>
        <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '12px', marginBottom: '20px', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('passenger')}
            style={{ flex: 1, padding: '10px 4px', background: activeTab === 'passenger' ? 'white' : 'transparent', color: activeTab === 'passenger' ? '#1e293b' : '#64748b', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            🎒 Αναζήτηση
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            style={{ flex: 1, padding: '10px 4px', background: activeTab === 'driver' ? 'white' : 'transparent', color: activeTab === 'driver' ? '#1e293b' : '#64748b', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            🚘 Οδηγός
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            style={{ flex: 1, padding: '10px 4px', background: activeTab === 'profile' ? 'white' : 'transparent', color: activeTab === 'profile' ? '#1e293b' : '#64748b', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            👤 Προφίλ {isProfileComplete ? '✅' : '⚠️'}
          </button>
        </div>

        {activeTab === 'passenger' && (
          <div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1e293b' }}>Αναζήτηση & Αυτόματος Υπολογισμός Τιμής</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>ΑΠΟ ΠΟΥ;</label>
                    <input type="text" placeholder="π.χ. Κατερίνη" value={searchOrigin} onChange={(e) => setSearchOrigin(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>ΠΟΥ ΠΑΣ;</label>
                    <input type="text" placeholder="π.χ. Λάρισα" value={searchDest} onChange={(e) => setSearchDest(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>ΗΜΕΡΟΜΗΝΙΑ (±3 ημέρες)</label>
                  <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155' }}>Διαθέσιμα Δρομολόγια</h3>
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{processedRides.length} βρέθηκαν</span>
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Φόρτωση...</p>
            ) : processedRides.length === 0 ? (
              <div style={{ background: 'white', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <p style={{ margin: 0 }}>Δεν βρέθηκαν δρομολόγια για αυτά τα κριτήρια.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                {processedRides.map(({ ride, result }) => {
                  const isExact = result.dateCategory === 'exact';
                  return (
                    <div key={ride.id} style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Διαδρομή</span>
                          <h4 style={{ margin: '2px 0 0 0', fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>{ride.origin} ➔ {ride.destination}</h4>
                        </div>
                        <div style={{ background: '#ecfdf5', color: '#047857', padding: '6px 12px', borderRadius: '12px', fontWeight: '800', fontSize: '16px' }}>
                          {result.calculatedPrice}€
                        </div>
                      </div>

                      {searchDate && (
                        <div style={{ marginBottom: '10px' }}>
                          {isExact ? (
                            <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>
                              ✅ Ακριβής ημερομηνία
                            </span>
                          ) : (
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>
                              📅 Εναλλακτική ημερομηνία ({result.dayDiff > 0 ? `+${result.dayDiff}` : result.dayDiff} μέρες)
                            </span>
                          )}
                        </div>
                      )}

                      {result.stopInfo && (
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '8px 12px', borderRadius: '10px', marginBottom: '10px', fontSize: '13px', fontWeight: '600' }}>
                          📍 {result.stopInfo}
                        </div>
                      )}

                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '12px', display: 'grid', gap: '6px', fontSize: '13px', color: '#334155' }}>
                        <div>🚘 <strong>Μεταφορέας:</strong> {ride.driver_name}</div>
                        <div>📅 <strong>Ημερομηνία & Ώρα:</strong> {ride.ride_date}</div>
                        <div>💺 <strong>Θέσεις:</strong> {ride.seats} διαθέσιμες</div>
                        <div style={{ color: '#047857', fontSize: '12px', fontStyle: 'italic' }}>🔒 Το τηλέφωνο & η πινακίδα του οδηγού αποκαλύπτονται μετά την κράτηση.</div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {ride.user_id === session.user.id ? (
                          <button onClick={() => handleDeleteRide(ride.id)} style={{ background: '#ffeeec', color: '#dc2626', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                            🗑️ Διαγραφή Δικού μου Δρομολογίου
                          </button>
                        ) : (
                          <div />
                        )}

                        <button 
                          onClick={() => handleBookRide(ride, result.calculatedPrice)} 
                          style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(22,163,74,0.3)' }}
                        >
                          💳 Κράτηση & Πληρωμή ({result.calculatedPrice}€)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'driver' && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#1e293b' }}>🚘 Δημοσίευση Νέας Διαδρομής</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Δημοσιεύεται ως: <strong>{currentUserName}</strong></p>

            <form onSubmit={handleAddRide} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>ΑΦΕΤΗΡΙΑ</label>
                <input type="text" placeholder="π.χ. Καβάλα" value={origin} onChange={(e) => setOrigin(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>ΠΡΟΟΡΙΣΜΟΣ</label>
                <input type="text" placeholder="π.χ. Αθήνα" value={destination} onChange={(e) => setDestination(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>ΗΜΕΡΟΜΗΝΙΑ</label>
                  <input type="date" value={rideDate} onChange={(e) => setRideDate(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>ΩΡΑ ΕΚΚΙΝΗΣΗΣ</label>
                  <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>ΕΚΤΙΜΩΜΕΝΗ ΩΡΑ ΑΦΙΞΗΣ</label>
                <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>ΔΙΑΘΕΣΙΜΕΣ ΘΕΣΕΙΣ</label>
                  <input type="number" placeholder="π.χ. 3" value={seats} onChange={(e) => setSeats(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>ΣΥΝΟΛΙΚΗ ΤΙΜΗ (€)</label>
                  <input type="number" placeholder="π.χ. 30" value={price} onChange={(e) => setPrice(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>

              <button type="submit" style={{ background: '#2563eb', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '16px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                🚀 Δημοσίευση Διαδρομής
              </button>
            </form>
          </div>
        )}

        {activeTab === 'profile' && (
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#1e293b' }}>👤 Το Προφίλ & Στοιχεία Οχήματος</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
              Λογαριασμός: <strong>{session.user.email}</strong>
            </p>

            <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>ΑΡΙΘΜΟΣ ΤΗΛΕΦΩΝΟΥ</label>
                  <input 
                    type="tel" 
                    placeholder="π.χ. 6912345678" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>ΑΡΙΘΜΟΣ ΠΙΝΑΚΙΔΑΣ ΟΧΗΜΑΤΟΣ</label>
                  <input 
                    type="text" 
                    placeholder="π.χ. ΚΥΕ-1234" 
                    value={carPlate} 
                    onChange={(e) => setCarPlate(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>ΑΡΙΘΜΟΣ ΚΑΡΤΑΣ ΠΛΗΡΩΜΗΣ</label>
                  <input 
                    type="text" 
                    placeholder="4532 •••• •••• 1234" 
                    value={cardNumber} 
                    onChange={(e) => setCardNumber(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={savingProfile}
                style={{ background: '#16a34a', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(22,163,74,0.3)', marginTop: '10px' }}
              >
                {savingProfile ? 'Αποθήκευση...' : '💾 Αποθήκευση Προφίλ & Στοιχείων'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
