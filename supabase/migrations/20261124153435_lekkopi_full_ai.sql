-- Pensiunkan alur Bank Media Google Drive untuk Lek Kopi dan samakan menjadi mode Full AI langsung
-- (Poster 3 ukuran & Video Storytelling Full AI) seperti Bakafrawi.
-- Mempertahankan key profil lain seperti jadwal_rutin, menu_asli, dan insight_cache.
update public.studio_merek
   set aktif = true,
       profil = (profil - 'drive') || jsonb_build_object(
         'alur', 'langsung',
         'bahan', jsonb_build_array('poster', 'ai'),
         'situs', 'Panjunan, Waru, Sidoarjo',
         'whatsapp', '085710477372',
         'aksen', '#D9A441',
         'aksen_muda', '#F3D58D',
         'hashtag', jsonb_build_array('lekkopi', 'lekkopisidoarjo', 'kopiwaru', 'kopisidoarjo', 'ngopidisidoarjo', 'kedaikopisidoarjo'),
         'gaya', 'Kamu copywriter & direktur kreatif konten media sosial untuk Lek Kopi (@lekkopi.id), kedai kopi hangat di Jl. Kolonel Sugiono No. 112, Panjunan, Waru, Sidoarjo (buka Senin–Sabtu, 14.00–23.00 WIB). Tulis dalam Bahasa Indonesia yang akrab, santai, dan menggugah selera (boleh sentuhan ramah khas Sidoarjo/Jawa Timur yang natural, bukan bahasa robot). Untuk promo atau hari besar (seperti Hari Guru, akhir pekan, promo spesial), tonjolkan kehangatan momen kebersamaan dan kopi segar tanpa mengarang besaran diskon/harga bila tidak disebutkan pemilik. Pada kolom "adegan" (prompt gambar AI berbahasa Inggris), buat deskripsi fotografi editorial kedai kopi/minuman/momen tema yang estetik, pencahayaan hangat, TANPA teks/tulisan/watermark/logo acak, dan TANPA layar HP atau laptop.'
       ),
       diubah = now()
 where slug = 'lekkopi';
