export const tr = {
  common: {
    loading: 'Yükleniyor...',
    retry: 'Tekrar dene',
    cancel: 'İptal',
    continue: 'Devam',
    error: 'Bir hata oluştu',
    save: 'Kaydet',
    saving: 'Kaydediliyor...',
    saved: 'Kaydedildi',
    edit: 'Düzenle',
    close: 'Kapat',
  },
  auth: {
    title: 'Tulpar',
    phoneLabel: 'Telefon numarası',
    phonePlaceholder: '+905551234567',
    phoneHelper: 'Uluslararası formatta yaz (örn. +905551234567)',
    requestOtp: 'Kod gönder',
    codeLabel: 'Doğrulama kodu',
    codePlaceholder: '6 haneli kod',
    codeHelper: 'Geliştirme modunda kod her zaman 123456',
    verify: 'Doğrula ve giriş yap',
    backToPhone: 'Telefonu değiştir',
    invalidPhone: 'Geçerli bir telefon gir (örn. +905551234567)',
    invalidCode: 'Kod 6 haneli olmalı',
    requestFailed: 'Kod gönderilemedi',
    verifyFailed: 'Giriş başarısız',
  },
  health: {
    title: 'Backend bağlantısı',
    healthy: 'Sağlıklı',
    degraded: 'Kısmen çalışıyor',
    unreachable: 'Backend erişilemez',
    database: 'Veritabanı',
    connected: 'bağlı',
    disconnected: 'kopuk',
    refresh: 'Yenile',
    logout: 'Çıkış yap',
  },
  tabs: {
    profile: 'Profil',
    matches: 'Maçlar',
    health: 'Bağlantı',
  },
  profile: {
    title: 'Profilim',
    edit: 'Profili düzenle',
    saveSuccess: 'Profil güncellendi',
    saveFailed: 'Profil güncellenemedi',
    loadFailed: 'Profil yüklenemedi',
    onboardingHint: 'Devam etmek için profilini tamamla.',
    fields: {
      username: 'Kullanıcı adı',
      firstName: 'Ad',
      lastName: 'Soyad',
      city: 'Şehir',
      district: 'İlçe',
      dateOfBirth: 'Doğum tarihi',
      height: 'Boy (cm)',
      weight: 'Kilo (kg)',
      position1: 'Birincil mevki',
      position2: 'İkincil mevki',
      position3: 'Üçüncül mevki',
      phone: 'Telefon',
      email: 'E-posta',
    },
    usernameChangesLeft: (n: number) =>
      n === 0
        ? 'Kullanıcı adı hakkın kalmadı'
        : `Kalan kullanıcı adı değişiklik hakkı: ${n}`,
    validation: {
      usernameFormat: 'Sadece harf, rakam, nokta ve alt çizgi',
      usernameLength: 'En fazla 30 karakter',
      nameLength: 'En fazla 50 karakter',
      cityLength: 'En fazla 50 karakter',
      districtLength: 'En fazla 50 karakter',
      heightRange: 'Boy 100–250 cm aralığında olmalı',
      weightRange: 'Kilo 30–200 kg aralığında olmalı',
      dateInvalid: 'Geçersiz tarih (gün/ay/yıl)',
      positionInvalid: 'Geçersiz mevki',
    },
    positionsHint: 'Mevkiler: GK, RB, RCB, LCB, LB, RWB, LWB, CDM, CM, CAM, RW, LW, ST, SS',
  },
  matches: {
    title: 'Maçlar',
    empty: 'Filtrene uyan maç bulunamadı.',
    loadFailed: 'Maçlar yüklenemedi',
    capacityLabel: (filled: number, total: number) => `${filled}/${total} dolu`,
    pricePerPerson: (amount: number) => `Kişi başı ${amount}₺`,
    locationFallback: 'Konum belirtilmemiş',
    timeFallback: 'Tarih yok',
    formatLabel: (n: number) => `${n}v${n}`,
    filters: {
      title: 'Filtrele',
      city: 'Şehir',
      cityPlaceholder: 'örn. İzmir',
      from: 'Başlangıç',
      to: 'Bitiş',
      format: 'Format',
      apply: 'Uygula',
      clear: 'Temizle',
      any: 'Hepsi',
    },
    pagination: {
      next: 'Sonraki',
      prev: 'Önceki',
      pageOf: (page: number, total: number) => `${page} / ${total}`,
    },
    createCta: 'Yeni maç',
  },
  dateTimeField: {
    placeholder: 'Tarih seç',
    clear: 'Temizle',
  },
  matchForm: {
    createTitle: 'Yeni Maç Oluştur',
    editTitle: 'Maçı Düzenle',
    submit: 'Kaydet',
    submitting: 'Kaydediliyor...',
    cancel: 'İptal',
    cancelMatch: 'Maçı iptal et',
    cancelConfirm: 'Bu maç iptal edilecek. Devam edilsin mi?',
    cancelYes: 'Evet, iptal et',
    cancelNo: 'Vazgeç',
    immutableHint: 'Bu alan değiştirilemez',
    fields: {
      format: 'Format',
      difficulty: 'Zorluk',
      privacy: 'Gizlilik',
      privacyOpen: 'Açık',
      privacyOpenHint: 'Herkes katılabilir',
      privacyLocked: 'Kilitli',
      privacyLockedHint: 'Katılım için istek gerekli',
      privacyInviteOnly: 'Davetli',
      privacyInviteOnlyHint: 'Sadece davet edilenler görür',
      city: 'Şehir',
      cityPlaceholder: 'örn. İstanbul',
      district: 'İlçe',
      districtPlaceholder: 'örn. Kadıköy',
      scheduledAt: 'Tarih ve saat',
      durationMin: 'Süre (dakika)',
      durationMinPlaceholder: '60',
      pitchName: 'Halı saha adı',
      pitchNamePlaceholder: 'örn. Yıldız Halı Saha',
      pitchAddress: 'Adres',
      pitchAddressPlaceholder: 'Sokak, numara, mahalle',
      pitchLat: 'Enlem',
      pitchLng: 'Boylam',
      pricePerPerson: 'Kişi başı ücret (₺)',
      pricePerPersonPlaceholder: '0',
    },
    difficultyOptions: {
      easy: 'Kolay',
      medium: 'Orta',
      hard: 'Zor',
    },
    errors: {
      formatRequired: 'Format seçilmeli',
      pricePositive: 'Ücret 0 veya daha büyük olmalı',
      durationRange: 'Süre 30–180 dakika arası olmalı',
      scheduledInPast: 'Tarih gelecekte olmalı',
      cityTooLong: 'Şehir 80 karakteri aşamaz',
      districtTooLong: 'İlçe 80 karakteri aşamaz',
      pitchNameTooLong: 'Halı saha adı 200 karakteri aşamaz',
      pitchAddressTooLong: 'Adres 500 karakteri aşamaz',
      latRange: 'Enlem -90 ile 90 arasında olmalı',
      lngRange: 'Boylam -180 ile 180 arasında olmalı',
      submitFailed: 'Kaydedilemedi',
    },
    success: {
      created: 'Maç oluşturuldu',
      updated: 'Maç güncellendi',
      cancelled: 'Maç iptal edildi',
    },
    blockedStateHint: 'Bu durumdaki maç düzenlenemez',
  },
  matchDetail: {
    loadFailed: 'Maç yüklenemedi',
    notFound: 'Maç bulunamadı',
    back: 'Geri',
    teamA: 'Takım A',
    teamB: 'Takım B',
    starters: 'İlk 11',
    reserves: 'Yedekler',
    emptySlot: 'Boş',
    join: 'Bu yere katıl',
    joining: 'Katılıyor...',
    leave: 'Maçtan ayrıl',
    leaving: 'Ayrılıyor...',
    leaveConfirm: 'Bu maçtan ayrılmak istediğine emin misin?',
    yes: 'Evet',
    no: 'Hayır',
    youAreHere: 'Sen',
    locked: 'Bu maç kilitli — katılmak için istek göndermen gerek',
    lockedOrganizer: 'Bu kilitli bir maç — organizatör olarak doğrudan katılabilirsin',
    lockedJoinDisabled: 'Kilitli maça doğrudan katılamazsın',
    cancelled: 'Bu maç iptal edildi',
    inviteOnly: 'Davetli maçı',
    capacity: (filled: number, total: number) =>
      `${filled}/${total} oyuncu`,
    organizer: (name: string) => `Düzenleyen: ${name}`,
    sendRequest: 'Katılım isteği gönder',
    sendingRequest: 'Gönderiliyor...',
    requestPending: 'İstek beklemede',
    requestRejected: 'İsteğin reddedildi',
    requestConfirm:
      'Organizatöre katılım isteği gönderilecek. Devam edilsin mi?',
    requestSent: 'İstek gönderildi',
    promoted: 'Yedekten ilk on bire geçtin!',
    // P2.M1: state pill labels for every MatchState. CANCELLED keeps the
    // banner-only treatment (no pill) to avoid duplicating the same info.
    stateLabels: {
      DRAFT: 'Taslak',
      OPEN: 'Açık',
      LOCKED: 'Kilitli',
      LIVE: 'Canlı',
      RATING_WINDOW: 'Oylama açık',
      CLOSED: 'Tamamlandı',
    } as Record<string, string>,
    countdown: {
      // Whole-unit Turkish formatter: 1sa 35dk / 25dk / 12sa / "az kaldı"
      format: (ms: number) => {
        if (ms <= 0) return 'az kaldı';
        const totalMin = Math.floor(ms / 60_000);
        const hours = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        if (hours <= 0) return `${mins}dk`;
        if (mins === 0) return `${hours}sa`;
        return `${hours}sa ${mins}dk`;
      },
      startsIn: (formatted: string) => `Başlamasına ${formatted} kaldı`,
      liveEndsIn: (formatted: string) => `Canlı — bitmesine ${formatted} kaldı`,
      ratingEndsIn: (formatted: string) =>
        `Oylama açık — ${formatted} içinde kapanıyor`,
    },
    rating: {
      title: 'Maçı puanla',
      openPill: 'Maçı puanla',
      hint: 'Sadece istediğin alanları puanla — her alanı doldurmak zorunda değilsin.',
      optionalHint:
        'Bir oyuncuda yalnızca saygıyı puanlayabilirsin, veya yalnızca performansı; istemediğin alanları boş bırak.',
      closed: 'Kapalı',
      closedHint: 'Oylama süresi kapandı. Puanlar artık düzenlenemez.',
      participantsOnly: 'Sadece bu maçtaki aktif oyuncular puan verebilir.',
      notParticipant:
        'Bu maça katılmadığın için puan veremezsin. Oylama maçtaki oyunculara açık.',
      empty: 'Puanlayabileceğin oyuncu yok.',
      performance: 'Performans',
      sportsmanshipTitle: 'Sportmenlik',
      saved: 'Puan kaydedildi',
      saveFailed: 'Puan kaydedilemedi',
      dirty: 'Değişti',
      editLimitReached: 'Bu oyuncu için düzenleme hakkın doldu.',
      editsLeft: (n: number) =>
        n === 0 ? 'Düzenleme yok' : `Düzenleme hakkı: ${n}`,
      playerMeta: (team: 'A' | 'B', position: string, reserve: boolean) =>
        `Takım ${team} · ${position}${reserve ? ' · yedek' : ''}`,
      // Sticky bottom bar
      saveAll: 'Tümünü kaydet',
      saveAllWithCount: (n: number) => `Tümünü kaydet (${n})`,
      savingProgress: (current: number, total: number) =>
        `Kaydediliyor… ${current}/${total}`,
      nothingDirty: 'Kaydedilecek değişiklik yok',
      partialSuccess: (ok: number, fail: number) =>
        `${ok} oyuncu kaydedildi, ${fail} oyuncu kaydedilemedi.`,
      back: 'Geri',
      axes: {
        respect: 'Saygı',
        sportsmanship: 'Sportmenlik',
        swearing: 'Küfürsüz oyun',
        aggression: 'Sakinlik',
        punctuality: 'Dakiklik',
      } as Record<string, string>,
    },
    errors: {
      conflict: 'Bu yer biraz önce doldu, başka bir yer seç',
      lockedJoin:
        'Bu maç kilitli. Katılmak için istek göndermen gerek.',
      cancelled: 'Bu maç artık katılıma kapalı.',
      generic: 'Bir sorun oluştu, tekrar dene',
      requestExists: 'Zaten beklemede bir isteğin var',
    },
  },
  userProfile: {
    title: 'Oyuncu profili',
    notFound: 'Kullanıcı bulunamadı',
    ratingsUnavailable: 'Puanlar yüklenemedi',
    reportCta: 'Bu oyuncuyu rapor et',
    unnamed: 'Adsız oyuncu',
    locationFallback: 'Konum bilinmiyor',
    positionsLabel: 'Tercih edilen mevkiler',
  },
  ratingsCard: {
    title: 'Puanlar',
    perPositionHeader: 'Mevkilere göre performans',
    sportsmanshipHeader: 'Sportmenlik',
    notEnoughDataYet: 'Henüz yeterli oy yok',
    empty: 'Henüz değerlendirme yok',
    raters: (n: number) => `${n} oy veren`,
    matches: (n: number) => `${n} maç`,
    axisRespect: 'Saygı',
    axisSportsmanship: 'Sportmenlik',
    axisSwearing: 'Küfür',
    axisAggression: 'Sertlik',
    axisPunctuality: 'Dakiklik',
    loadFailed: 'Puanlar yüklenemedi. Tekrar dene.',
  },
  report: {
    modalTitle: 'Oyuncuyu rapor et',
    reasonLabel: 'Sebep',
    notesLabel: 'Açıklama (isteğe bağlı, en fazla 500 karakter)',
    notesPlaceholder: 'Ek detay yaz...',
    submit: 'Gönder',
    submitting: 'Gönderiliyor…',
    cancel: 'Vazgeç',
    success: 'Rapor gönderildi',
    alreadyReported: 'Bu kullanıcıyı zaten rapor ettin',
    submitFailed: 'Gönderilemedi. Tekrar dene.',
    reasons: {
      CHAT_SWEARING: 'Sohbette küfür',
      CHAT_TOXICITY: 'Sohbette toksiklik',
      CHAT_TROLLING: 'Sohbette trollük',
      GAME_SWEARING: 'Maç içinde küfür',
      GAME_AGGRESSION: 'Maç içinde saldırganlık',
      GAME_INSULT: 'Maç içinde hakaret',
      NO_SHOW: 'Maça gelmedi',
      RANK_CHEATING: 'Sıralama hilesi',
      OTHER: 'Diğer',
    },
  },
  chat: {
    title: 'Maç sohbeti',
    inputPlaceholder: 'Mesajını yaz...',
    send: 'Gönder',
    sending: 'Gönderiliyor...',
    empty: 'Henüz mesaj yok. İlk mesajı sen yaz!',
    loadFailed: 'Mesajlar yüklenemedi',
    sendFailed: 'Mesaj gönderilemedi',
    loadMore: 'Daha eski mesajları yükle',
    loadingMore: 'Yükleniyor...',
    systemLabel: 'Sistem',
    tooLong: 'Mesaj 500 karakteri aşamaz',
    open: 'Sohbete git',
  },
  notifications: {
    title: 'Bildirimler',
    empty: 'Henüz bildirim yok',
    loadFailed: 'Bildirimler yüklenemedi',
    markAllRead: 'Tümünü okundu işaretle',
    marking: 'İşaretleniyor...',
    unreadBadge: (n: number) => (n > 99 ? '99+' : String(n)),
    relativeTime: (iso: string) => {
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return '';
      const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
      if (diffSec < 60) return 'az önce';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} dk önce`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} sa önce`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 7) return `${diffDay} g önce`;
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}.${mm}.${d.getFullYear()}`;
    },
  },
  matchRequests: {
    title: (n: number) => `Bekleyen istekler (${n})`,
    empty: 'Bekleyen istek yok',
    loadFailed: 'İstekler yüklenemedi',
    approve: 'Onayla',
    reject: 'Reddet',
    approving: 'Onaylanıyor...',
    rejecting: 'Reddediliyor...',
    confirmApprove: (name: string) =>
      `${name} kullanıcısı maça eklensin mi?`,
    confirmReject: (name: string) =>
      `${name} kullanıcısının isteği reddedilsin mi?`,
    preferredPosition: (pos: string) => `Tercih: ${pos}`,
    profilePositions: (positions: string[]) =>
      positions.length
        ? `Mevkiler: ${positions.join(', ')}`
        : 'Mevki belirtilmemiş',
  },
} as const;

