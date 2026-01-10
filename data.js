// Base de datos de videos organizados por categoría
const videosData = {
    categories: [
        {
            id: "ia-productividad",
            name: "Inteligencia Artificial y Productividad",
            icon: "🤖",
            description: "Herramientas de IA para optimizar flujos de trabajo"
        },
        {
            id: "ia-negocios",
            name: "Inteligencia Artificial: Negocios y Marketing",
            icon: "💼",
            description: "IA aplicada a estrategias de negocio y marketing"
        },
        {
            id: "ia-fundamentos",
            name: "Inteligencia Artificial: Fundamentos, Tecnología y Herramientas",
            icon: "⚙️",
            description: "Conceptos fundamentales y ecosistema de herramientas de IA"
        },
        {
            id: "ia-desarrollo",
            name: "Inteligencia Artificial: Desarrollo y Programación",
            icon: "💻",
            description: "Creación de aplicaciones asistida por IA"
        },
        {
            id: "ia-futuro",
            name: "Inteligencia Artificial: Futuro, Sociedad y Riesgos",
            icon: "🔮",
            description: "Impacto social y dilemas éticos de la IA"
        },
        {
            id: "inversion",
            name: "Inversión y Finanzas",
            icon: "📈",
            description: "Principios de inversión y gestión financiera"
        },
        {
            id: "negocios",
            name: "Negocios y Emprendimiento",
            icon: "🚀",
            description: "Principios para crear y escalar negocios"
        },
        {
            id: "productividad",
            name: "Productividad y Desarrollo Personal",
            icon: "⚡",
            description: "Métodos para optimizar el tiempo y el aprendizaje"
        },
        {
            id: "psicologia",
            name: "Psicología y Filosofía",
            icon: "🧠",
            description: "Exploración de la mente y grandes preguntas existenciales"
        },
        {
            id: "salud",
            name: "Salud y Bienestar",
            icon: "❤️",
            description: "Estrategias para mejorar la longevidad y calidad de vida"
        },
        {
            id: "economia",
            name: "Economía y Geopolítica",
            icon: "🌍",
            description: "Fuerzas macroeconómicas y geopolíticas globales"
        },
        {
            id: "tecnologia",
            name: "Tecnología y Futuro Digital",
            icon: "🔧",
            description: "Innovaciones tecnológicas y tendencias digitales"
        }
    ],

    videos: [
        // 1.0 Inteligencia Artificial y Productividad
        {
            categoryId: "ia-productividad",
            title: "10 herramientas IA para TRABAJAR un 50% MENOS y generar EL DOBLE",
            author: "Gustavo Entrala",
            summary: "Se presenta la herramienta NotebookLM de Google, que permite procesar documentos PDF para generar automáticamente catálogos de preguntas y respuestas, guías de estudio o conversaciones interactivas sobre el contenido."
        },
        {
            categoryId: "ia-productividad",
            title: "101 Ways To Use AI In Your Daily Life",
            author: "Tina Huang",
            summary: "El contenido explora usos prácticos de la IA, como la edición de textos para mejorar gramática y tono, la realización de 'brainstorming' estructurado, y el uso de funciones de voz para practicar negociaciones o simular conversaciones difíciles."
        },
        {
            categoryId: "ia-productividad",
            title: "61 usos reales de la IA para mejorar tu vida (de verdad)",
            author: "Migue Baena IA",
            summary: "Se recopilan más de 60 aplicaciones de la IA divididas en cinco categorías clave: productividad laboral, simplificación de tareas personales, aprendizaje, gestión financiera y desarrollo de la carrera profesional."
        },
        {
            categoryId: "ia-productividad",
            title: "ChatGPT: 7 Hacks PRO para pasar de Nivel 1 a 99 (Guía 20 min)",
            author: "Emprende Aprendiendo",
            summary: "Se detallan técnicas avanzadas para usar ChatGPT, como forzar a la IA a autocorregir sus propios resultados para mejorar la calidad de las respuestas y utilizar la función de memoria para que el modelo recuerde conversaciones."
        },
        {
            categoryId: "ia-productividad",
            title: "Cómo crear un GPT Personalizado que trabaje por ti (paso a paso)",
            author: "Romuald Fons",
            summary: "El vídeo explica cómo crear un GPT personalizado, destacando que se necesita una cuenta de pago de ChatGPT y recomendando la configuración manual para obtener un mayor control sobre el resultado final."
        },
        {
            categoryId: "ia-productividad",
            title: "Gemini 3 + NotebookLM: 5 casos prácticos para trabajar mejor (y gratis)",
            author: "Migue Baena IA",
            summary: "Se explica la integración de NotebookLM directamente en Gemini, lo que permite utilizar el contenido de un cuaderno como contexto para generar aplicaciones, presentaciones o páginas web."
        },
        {
            categoryId: "ia-productividad",
            title: "Por qué la IA te da RESPUESTAS MEDIOCRES (otros sacan ORO)",
            author: "Gustavo Entrala",
            summary: "Se enfatiza la importancia de especificar el formato y proporcionar ejemplos a la IA para mejorar la calidad de sus respuestas, transmitiendo así el contexto implícito de nuestra mente a la inteligencia artificial."
        },
        {
            categoryId: "ia-productividad",
            title: "¡Nuevo Gemini en el TOP 1! Y esto es lo que puedes Hacer Ahora 🚀",
            author: "Alejavi Rivera",
            summary: "Se demuestra cómo usar Gemini como un asistente personal para organizar tareas, conectándolo con aplicaciones como Google Calendar y Google Tasks para que genere recordatorios y planifique actividades."
        },

        // 2.0 Inteligencia Artificial: Negocios y Marketing
        {
            categoryId: "ia-negocios",
            title: "5 AI Business Ideas for 2026 (That Made Me 7-Figures)",
            author: "Sara Finance",
            summary: "Se propone como idea de negocio la creación de contenido en un nicho específico de IA, como herramientas para e-commerce. La estrategia consiste en identificar las mejores soluciones y crear vídeos para monetizar a través de afiliados."
        },
        {
            categoryId: "ia-negocios",
            title: "7 Mind-Blowing NEW Use Cases For ChatGPT in 2025 (Big Changes Ahead)",
            author: "Wes McDowell",
            summary: "Se explica cómo usar ChatGPT para analizar grandes volúmenes de datos de clientes y extraer frases clave ('voice of customer data'), permitiendo optimizar el copywriting de sitios web y campañas de marketing."
        },
        {
            categoryId: "ia-negocios",
            title: "Deepseek-V3 Computer Use AI Agents are INSANE (FREE!) 🤯",
            author: "Julian Goldie Agency",
            summary: "Se muestra la capacidad de un agente de IA para navegar por internet de forma autónoma, realizando tareas como buscar en Google, analizar competidores para SEO y generar un esquema de contenido."
        },
        {
            categoryId: "ia-negocios",
            title: "Salesforce Founder Gives the Truth on AI Agents w/ Marc Benioff | EP #141",
            author: "Peter H. Diamandis",
            summary: "Marc Benioff analiza cómo la tecnología de agentes de IA permite a Salesforce aumentar drásticamente la productividad en ingeniería y gestionar el soporte al cliente de manera autónoma."
        },
        {
            categoryId: "ia-negocios",
            title: "Selling AI Solutions In 2026 is Stupid",
            author: "Liam Evans",
            summary: "El autor argumenta que para vender soluciones de IA eficazmente no basta con ofrecer una herramienta aislada, sino que es necesario convertirse en un experto en el negocio del cliente."
        },
        {
            categoryId: "ia-negocios",
            title: "URGENTE: 10 Negocios IA en 2025 (+$5KMes) Paso a Paso",
            author: "Carlos Rodera",
            summary: "Se identifica una oportunidad de negocio en el desequilibrio entre la alta demanda de implementación de IA por parte de las empresas y la falta de profesionales que conecten las herramientas con las necesidades del mercado."
        },
        {
            categoryId: "ia-negocios",
            title: "Your First $100K | Build a Profitable One Person Business with AI",
            author: "Grace Leung",
            summary: "El vídeo describe estrategias de inbound y outbound marketing para un negocio unipersonal, destacando que la IA debe ser una palanca para escalar la creación de contenido, no para reemplazar el pensamiento estratégico."
        },
        {
            categoryId: "ia-negocios",
            title: "¡GRATIS! Google lanza una IA que crea apps sin saber programar",
            author: "Migue Baena IA",
            summary: "Se presenta un caso de uso donde una IA investiga a fondo un negocio a partir de su sitio web y datos públicos, rastreando la información disponible para resumirla en un plan estructurado."
        },
        {
            categoryId: "ia-negocios",
            title: "Marc Benioff Strikes Back at Satya: 'AGI is Not Here'",
            author: "The Logan Bartlett Show",
            summary: "Marc Benioff de Salesforce discute la transición de ser una empresa de software tradicional a una que proporciona 'trabajadores digitales' o agentes de IA a sus clientes."
        },

        // 3.0 Inteligencia Artificial: Fundamentos, Tecnología y Herramientas
        {
            categoryId: "ia-fundamentos",
            title: "Best AI Tools for 2025 across 22 Categories",
            author: "Educraft",
            summary: "Se presenta una comparativa de herramientas de IA para crear presentaciones, destacando Gamma por sus potentes funciones para generar esquemas, contenido e imágenes personalizadas."
        },
        {
            categoryId: "ia-fundamentos",
            title: "ChatGPT Agent VS Manus - ¿Cuál es el mejor agente de IA?",
            author: "EDteam",
            summary: "Se comparan los agentes de IA ChatGPT Agent y Manus. Mientras que ChatGPT Agent destacó en el análisis de información, Manus demostró ser superior en velocidad y en la calidad de la presentación final."
        },
        {
            categoryId: "ia-fundamentos",
            title: "Cómo usar la IA DEEPSEEK en MÓVIL, WEB, LOCAL y con TUS NOTAS",
            author: "Emowe",
            summary: "Se explica cómo ejecutar modelos de IA como DeepSeek de forma local para no depender de internet y garantizar la privacidad de la información."
        },
        {
            categoryId: "ia-fundamentos",
            title: "DeepSeek Está A PUNTO de SORPRENDER AL MUNDO con R2, es 40 Veces MÁS Eficiente que la IA de OpenAI",
            author: "IA Innova",
            summary: "El vídeo anuncia que Deepseek está acelerando el lanzamiento de su próximo modelo de IA, que promete ser hasta 40 veces más eficiente en costes que los de OpenAI."
        },
        {
            categoryId: "ia-fundamentos",
            title: "Descubre en 11 minutos cómo funciona la INTELIGENCIA ARTIFICIAL",
            author: "Emowe",
            summary: "Se explica de forma sencilla que los modelos de IA realizan predicciones basadas en probabilidades matemáticas y redes neuronales, poseyendo conocimiento únicamente del universo de información con el que fueron entrenados."
        },
        {
            categoryId: "ia-fundamentos",
            title: "El Mejor Curso Gratis De Inteligencia Artificial",
            author: "Adrián Sáenz",
            summary: "Se ofrece un curso gratuito que cubre desde los fundamentos de ChatGPT hasta la creación de agencias de IA, agentes con N8N, automatizaciones con Make y el desarrollo de páginas web con IA."
        },
        {
            categoryId: "ia-fundamentos",
            title: "Experto en IA: Cómo Aprovechar la IA y cómo No Quedarte Atrás en esta Revolución",
            author: "Tengo un Plan",
            summary: "Se discute la diferencia entre realidad virtual, aumentada y extendida, destacando dispositivos como Apple Vision Pro y Meta Quest 3."
        },
        {
            categoryId: "ia-fundamentos",
            title: "Explotó la burbuja de la IA Generativa",
            author: "RBG Escuela",
            summary: "Se argumenta que, aunque pueda haber una 'burbuja' en el número de aplicaciones de IA, la tecnología a nivel empresarial tiene un potencial inmenso. Se predice que el mercado se consolidará en unos pocos actores principales."
        },
        {
            categoryId: "ia-fundamentos",
            title: "Google Destroza la IA con estas Herramientas GRATIS y SIN Límites 🔥",
            author: "Alejavi Rivera",
            summary: "Se presenta Google AI Studio como una plataforma gratuita e ilimitada para acceder a los modelos de IA más potentes de Google."
        },
        {
            categoryId: "ia-fundamentos",
            title: "Harvard Professor Explains Algorithms in 5 Levels of Difficulty | WIRED",
            author: "WIRED",
            summary: "Un profesor de Harvard explica que los algoritmos de aprendizaje determinan en gran medida el contenido que vemos en plataformas como YouTube o Netflix."
        },
        {
            categoryId: "ia-fundamentos",
            title: "I Tested Every Deep Research AI Tool To Find The Best One (SHOCKING TRUTH)",
            author: "Rob The AI Guy",
            summary: "Se realiza una comparativa entre herramientas de investigación con IA como Gemini, ChatGPT y Perplexity."
        },
        {
            categoryId: "ia-fundamentos",
            title: "La gran mentira de la Inteligencia Artificial 🤖 | 🎙️ Ramón L. de Mántaras - Podcast IA 🟣",
            author: "Inteligencia Artificial",
            summary: "Un experto en IA debate sobre si la IA realmente razona, mencionando la postura de figuras como Hinton sobre la posible consciencia en estos sistemas."
        },
        {
            categoryId: "ia-fundamentos",
            title: "Olvídate de ChatGPT: Estos agentes de IA hacen TODO por ti",
            author: "Migue Baena IA",
            summary: "Se presenta una nueva generación de agentes de IA capaces de realizar tareas de forma autónoma. Se destaca la herramienta Gemsparks Superagent."
        },
        {
            categoryId: "ia-fundamentos",
            title: "TUTORIAL CREAR PRESENTACIONES en VIDEO GRATIS con IA - VIDEOPRESENTACIONES - adiós PowerPoint",
            author: "Joaquín Barberá - Inteligencia Artificial",
            summary: "Se muestra cómo utilizar la herramienta Fliki para crear vídeo-presentaciones. La plataforma permite añadir escenas, narrar texto automáticamente y seleccionar vídeos."
        },
        {
            categoryId: "ia-fundamentos",
            title: "The Future of AI: Leaders from TikTok, Google & More Weigh In (FII Panel) | EP #127",
            author: "Peter H. Diamandis",
            summary: "Se discuten los cuellos de botella tecnológicos que enfrenta la industria de la IA, como la disponibilidad de datos, la energía y la refrigeración."
        },
        {
            categoryId: "ia-fundamentos",
            title: "Why MCP Saves 90% of Your Manual AI Work | Model Context Protocol Explained",
            author: "Grace Leung",
            summary: "Se explica el 'Model Context Protocol' (MCP) y las formas de conectar un sistema de IA a servidores MCP."
        },
        {
            categoryId: "ia-fundamentos",
            title: "¡NOVEDAD! Gemini 2.5 Pro + Agente IA 🤯 Crea PRESENTACIONES INTERACTIVAS (Gratis)",
            author: "Xavier Mitjana",
            summary: "Se demuestra el uso de una herramienta para crear presentaciones interactivas con IA que genera diapositivas con gráficos que muestran información detallada."
        },
        {
            categoryId: "ia-fundamentos",
            title: "¡VEO 3 ya no es el mejor! 🤯 Descubre SeeDance (más rápido, más barato y más potente)",
            author: "Xavier Mitjana",
            summary: "Se realiza una comparativa de modelos de generación de vídeo con IA, enfrentando SeeDance con VEO 3 y Kling 2.1."
        },
        {
            categoryId: "ia-fundamentos",
            title: "¿Gemini o ChatGPT? Elige mal y perderás tiempo y dinero",
            author: "Migue Baena IA",
            summary: "Se comparan Gemini 2.5 Pro y ChatGPT, destacando que Gemini es superior para procesar grandes volúmenes de información y ChatGPT es mejor en el análisis de datos."
        },

        // 4.0 Inteligencia Artificial: Desarrollo y Programación
        {
            categoryId: "ia-desarrollo",
            title: "Cómo convertir una idea en una aplicación con IA (paso a paso)",
            author: "Migue Baena IA",
            summary: "Se describe un flujo de trabajo para convertir una idea en un MVP (Producto Mínimo Viable) de una aplicación utilizando NotebookLM."
        },
        {
            categoryId: "ia-desarrollo",
            title: "Gemini Coder: Esta IA Crea Apps Completas en SEGUNDOS | SIN saber PROGRAMAR 😱",
            author: "Conciencia Artificial",
            summary: "Se presenta Gemini Coder, una plataforma que genera aplicaciones web completas a partir de indicaciones de texto simples utilizando modelos como Gemini 1.5 Pro."
        },
        {
            categoryId: "ia-desarrollo",
            title: "NotebookLM + Gemini: FUSION BRUTAL para crear APP's en Google AI",
            author: "NextGen IA Hub",
            summary: "El vídeo se enfoca en enseñar a los usuarios a manejar la combinación de NotebookLM, Gemini y Google AI Studio para crear aplicaciones."
        },
        {
            categoryId: "ia-desarrollo",
            title: "¡Google humilla a ChatGPT con estas 5 IAs brutales!",
            author: "Migue Baena IA",
            summary: "Se muestra cómo la IA puede generar un prototipo visual de una aplicación, incluyendo el texto para la página de presentación y un prompt técnico detallado."
        },
        {
            categoryId: "ia-desarrollo",
            title: "🔥 Crea RAGS LOCALES Desde CERO: Guía DEFINITIVA Paso a Paso",
            author: "Agustín Medina | AI Agency Academy",
            summary: "Se detalla el proceso para crear un flujo que recupera información de documentos PDF, utilizando embeddings y bases de datos vectoriales."
        },
        {
            categoryId: "ia-desarrollo",
            title: "🚀 Cómo Automatizar la Navegación Web con DeepSeek y Web Agent",
            author: "Tecnolitas",
            summary: "El vídeo explica cómo instalar y configurar un repositorio de código abierto para automatizar la navegación web."
        },

        // 5.0 Inteligencia Artificial: Futuro, Sociedad y Riesgos
        {
            categoryId: "ia-futuro",
            title: "IA y el futuro: ¿Qué trabajos desaparecerán? ¿Qué pasará?",
            author: "Date un Vlog",
            summary: "Se destaca que, por primera vez, las máquinas de IA muestran comportamientos emergentes no programados explícitamente por sus creadores."
        },
        {
            categoryId: "ia-futuro",
            title: "OpenAI Reveals Why They Are SCARED To Release Their New AI Product",
            author: "TheAIGRID",
            summary: "Se discuten los riesgos de los 'prompt injections', donde instrucciones ocultas en webs o imágenes pueden anular las directrices del usuario."
        },
        {
            categoryId: "ia-futuro",
            title: "The $200 AI That's Too Smart to Use (GPT-5 Pro Paradox Explained)",
            author: "AI News & Strategy Daily | Nate B Jones",
            summary: "Se sugiere que futuros modelos como GPT-5 Pro destacarán en tareas que requieren razonamiento paralelo, como la investigación científica."
        },
        {
            categoryId: "ia-futuro",
            title: "The 8 AI Skills That Will Separate Winners From Losers in 2025",
            author: "Liam Ottley",
            summary: "Se identifican habilidades clave como la generación de contenido con IA (Midjourney, Runway AI) y su posterior edición."
        },
        {
            categoryId: "ia-futuro",
            title: "🚨 NOTICIAS IA 🚨: ¿La IA nos hace más idiotas? El MIT dice que SÍ 🤖🧠",
            author: "Inteligencia Artificial",
            summary: "Se discute un estudio del MIT que sugiere que delegar tareas de escritura a una IA puede llevar a una pérdida cognitiva."
        },

        // 6.0 Inversión y Finanzas
        {
            categoryId: "inversion",
            title: "Charlie Munger revela consejos de inversión para mayores de 50 años+",
            author: "Sabiduría Financiera",
            summary: "Charlie Munger aconseja a los inversores mayores de 50 años adoptar una estrategia defensiva, evitando el apalancamiento y la especulación."
        },
        {
            categoryId: "inversion",
            title: "Conferencia de Warren Buffet: Berkshire Hathaway - Doblaje al Español",
            author: "Trebol Finanzas",
            summary: "Warren Buffett opina que, a pesar de los riesgos crecientes por el cambio climático, el negocio de los seguros puede ser rentable si los precios se fijan correctamente."
        },
        {
            categoryId: "inversion",
            title: "El Colapso del Sistema Financiero ha comenzado (cómo protegerte)",
            author: "Javi Linares",
            summary: "Se explica que la deuda pública se gestiona a través de impuestos crecientes y la devaluación del dinero. Como protección, se recomienda invertir en oro y renta variable."
        },
        {
            categoryId: "inversion",
            title: "Estratega #1 de Riqueza: 'Si tienes entre 27 y 45 años, Haz esto con tu Dinero en 2025'",
            author: "Tengo un Plan",
            summary: "Se argumenta que las caídas del mercado deben verse como oportunidades de inversión, no como motivo de pánico."
        },
        {
            categoryId: "inversion",
            title: "Ex-inversor de 10.000 Millones: La Verdad Sobre la Bolsa y el Activo que Cambiará Tu Vida #LFDE",
            author: "Uri Sabat",
            summary: "Un ex-trader explica cómo funcionaba su trabajo en la banca de inversión estructurando derivados financieros."
        },
        {
            categoryId: "inversion",
            title: "Experta En Inversión: Cómo Gestionar Tu Dinero Como El 1% En 2026",
            author: "Adrián Sáenz",
            summary: "Se comparan los ETFs con los fondos de gestión activa, destacando que los ETFs son una opción barata y sencilla para la mayoría."
        },
        {
            categoryId: "inversion",
            title: "Hablemos del Dividendo: Mi opinión",
            author: "Javier DV - Inversión y Finanzas",
            summary: "Se concluye que el dividendo por sí solo es irrelevante, pero las empresas que los pagan a menudo comparten factores como el valor y la alta rentabilidad."
        },
        {
            categoryId: "inversion",
            title: "Las 8 REGLAS de WARREN BUFFETT para INVERTIR y GANAR DINERO en BOLSA | ✉️Resumen CARTAS ANUALES",
            author: "Adrià Rivero - Inversión en Bolsa",
            summary: "Se explica la evolución en la filosofía de inversión de Warren Buffett, pasando de comprar empresas mediocres a precios muy bajos a invertir en compañías de alta calidad."
        },
        {
            categoryId: "inversion",
            title: "Mi honesto consejo para alguien que quiere ingresos pasivos",
            author: "Adrián Sáenz",
            summary: "Se argumenta que, desde una perspectiva fiscal, la revalorización de activos es más eficiente que los dividendos."
        },
        {
            categoryId: "inversion",
            title: "Oaktree's Howard Marks on Credit Yields, Trump's Tariffs",
            author: "Bloomberg Television",
            summary: "Howard Marks afirma que la incertidumbre sobre el futuro económico es más alta que nunca."
        },
        {
            categoryId: "inversion",
            title: "Resultados de BABA con Gabriel Castro",
            author: "Locos de Wall Street",
            summary: "Se analiza la situación de Alibaba, señalando que a una empresa en China se le exige repartir dinero al accionista o demostrar crecimiento."
        },
        {
            categoryId: "inversion",
            title: "Se acerca algo peor que una crisis…",
            author: "Adrián Sáenz",
            summary: "Se destaca el error común de vender durante las caídas del mercado. Se argumenta que invertir en bolsa permite participar en el crecimiento de las empresas más grandes."
        },
        {
            categoryId: "inversion",
            title: "Warren Buffett: Las 5 Advertencias de su NUEVA Carta Anual (Resumen Completo)",
            author: "Adrià Rivero - Inversión en Bolsa",
            summary: "Se señala que Berkshire Hathaway mantiene una posición de efectivo muy alta porque Buffett no encuentra oportunidades de inversión a precios atractivos."
        },
        {
            categoryId: "inversion",
            title: "¿Oportunidad en PGMs? El metal olvidado que puede dispararse ⎮ HP SORPRENDE",
            author: "Locos de Wall Street",
            summary: "Se analiza el rendimiento de HP, destacando un aumento en la competencia en el mercado de hardware para empresas."
        },
        {
            categoryId: "inversion",
            title: "💥 La MAYORÍA de la GENTE no tiene NI IDEA de lo que se ACERCA|👉El último AVISO de la Reserva Federal",
            author: "Arte de invertir",
            summary: "Se advierte que, aunque las grandes tecnológicas son negocios sólidos, sus valoraciones actuales hacen improbable que repliquen los rendimientos pasados."
        },
        {
            categoryId: "inversion",
            title: "💥 TARGET, la caida en bolsa de un GIGANTE crisis|👉 Oportunidad?",
            author: "El_inversor_value",
            summary: "Se analiza la situación de Target, indicando que a pesar de una caída en la valoración, la compañía ha incrementado sus beneficios."
        },
        {
            categoryId: "inversion",
            title: "💥Warren Buffett explica la verdadera razón por la que está vendiendo sus acciones",
            author: "Invierte y gana",
            summary: "Se explica que Warren Buffett ha aumentado su posición en bonos a corto plazo, que ofrecen rentabilidades superiores al 4%."
        },
        {
            categoryId: "inversion",
            title: "🚨BLACKROCK ya se está moviendo ante la ECONOMÍA: la gran protección ante el sistema",
            author: "Hector Chamizo",
            summary: "Se defiende la idea de tener una exposición a Bitcoin como forma de diversificación y protección ante la incertidumbre económica."
        },

        // 7.0 Negocios y Emprendimiento
        {
            categoryId: "negocios",
            title: "30 MÁQUINAS FÁCILES DE IMPORTAR DESDE CHINA PARA INICIAR UN NEGOCIO DESDE CASA",
            author: "Espíritu Emprendedor 🅥",
            summary: "Se presentan ideas de negocio basadas en la importación de maquinaria de bajo coste desde China, como máquinas para fabricar tizas o servilletas."
        },
        {
            categoryId: "negocios",
            title: "Así Gana 10,000€/mes con YouTube Shorts | Iván Marquina",
            author: "Javier Limonchi",
            summary: "Un emprendedor detalla su modelo de negocio, explicando cómo gestiona a su equipo ofreciendo a su editor un salario fijo más bonificaciones."
        },
        {
            categoryId: "negocios",
            title: "CHINA DESVELA LA CARA OCULTA DE CHINA🇨🇳 | Lijia Cai",
            author: "Sifu Shun",
            summary: "Se discuten oportunidades de negocio como la optimización de procesos empresariales externalizando tareas a China."
        },
        {
            categoryId: "negocios",
            title: "Cómo llevar una empresa de 0 al IBEX 35, con Ismael Clemente",
            author: "Indexa Capital",
            summary: "El ponente atribuye parte de su éxito a la educación jesuita, que le inculcó una mentalidad abierta y el valor de ser una persona cumplidora."
        },
        {
            categoryId: "negocios",
            title: "EX DIRECTIVO DE APPLE: Cómo construir empresas billonarias | Manu Marín",
            author: "Dinstinto",
            summary: "Se argumenta que, aunque los jóvenes pueden crear empresas disruptivas, la alta probabilidad de fracaso sugiere empezar en un campo conocido."
        },
        {
            categoryId: "negocios",
            title: "How To Build A $10M AI App In Literally 30 Seconds (this is insane)",
            author: "My First Million",
            summary: "Se relata la experiencia de ser entrevistado en Y Combinator, destacando la alta presión y que el crecimiento viral de Replit se debió a su facilidad de uso."
        },
        {
            categoryId: "negocios",
            title: "Isra Bravo: Lo Que Nunca He Contado (Copywriter #1)",
            author: "No Solo Éxito",
            summary: "El copywriter Isra Bravo explica que llega un punto en que la ambición de avanzar se vuelve más importante que la acumulación de dinero."
        },
        {
            categoryId: "negocios",
            title: "Smartest Route To $10,000/Month In 2026",
            author: "Mark Tilbury",
            summary: "Se propone una ruta para alcanzar altos ingresos que comienza por dejar de ser un consumidor pasivo de contenido y empezar a aplicar lo aprendido."
        },
        {
            categoryId: "negocios",
            title: "The 4 Most Profitable Businesses to Start in 2025",
            author: "Natalie Dawson",
            summary: "Se recomienda especializarse en una única plataforma de redes sociales y en una industria específica para ofrecer servicios de marketing."
        },
        {
            categoryId: "negocios",
            title: "The Power of Framework Thinking for Executives (Mental Models in Business)",
            author: "Kara Ronin",
            summary: "Se explica el modelo mental del 'pensamiento de segundo orden', que consiste en anticipar las consecuencias a largo plazo de una decisión."
        },
        {
            categoryId: "negocios",
            title: "¿Podrá un solo académico DESTRUIR GOOGLE? La apuesta de PERPLEXITY AI",
            author: "Gustavo Entrala",
            summary: "El fundador de Perplexity AI superó la falta de experiencia empresarial construyendo un prototipo funcional en lugar de una presentación de PowerPoint."
        },

        // 8.0 Productividad y Desarrollo Personal
        {
            categoryId: "productividad",
            title: "10 libros que debí leer en mi infancia (y cómo pueden ayudar a formar hijos exitosos)",
            author: "Mis Propias Finanzas",
            summary: "Se recomienda el libro 'El obstáculo es el camino' de Ryan Holiday, que recoge la filosofía estoica. Su mensaje central es que los obstáculos son inevitables y deben ser vistos como regalos."
        },
        {
            categoryId: "productividad",
            title: "Apple Notas + Voz + AI: esto no lo cuenta nadie!",
            author: "Rodri Royg",
            summary: "Se presenta un método para mejorar la retención de lectura utilizando notas de voz. En lugar de subrayar, el usuario lee y comenta en voz alta las ideas que le resuenan."
        },
        {
            categoryId: "productividad",
            title: "Apple Notes + Reminders + Calendars - The PERFECT PRODUCTIVITY system",
            author: "The Tech Girl",
            summary: "Se describe un sistema de productividad unificado utilizando las aplicaciones nativas de Apple, integrando eventos del Calendario con Recordatorios y Notas."
        },
        {
            categoryId: "productividad",
            title: "Consejos para ser más productivo y alegre, con Mago More",
            author: "Lunes Inspiradores",
            summary: "El ponente expresa su fascinación por la tecnología como una herramienta para acelerar el aprendizaje."
        },
        {
            categoryId: "productividad",
            title: "EL MÉTODO JAPONÉS QUE CONVIERTE LA PEREZA EN / PRODUCTIVIDAD EXTREMA",
            author: "HACKEANDO LA MENTE",
            summary: "Se explora un método japonés que ve la pereza como un combustible para la eficiencia. Se cita el ejemplo de Satoru Iwata en Nintendo."
        },
        {
            categoryId: "productividad",
            title: "EL MÉTODO ZETTELKASTEN de Sönke Ahrens (Resumen del Libro y Cómo Tomar Notas o Apuntes Efectivos)",
            author: "Día Productivo",
            summary: "Se describe el método Zettelkasten para la toma de notas, recomendando registrar notas literarias y notas de ideas propias."
        },
        {
            categoryId: "productividad",
            title: "Este MAPA me ayudó a pasar de TOMAR NOTAS en papel a digital",
            author: "Emowe",
            summary: "Se recomienda construir un sistema de gestión del conocimiento personal utilizando el lenguaje Markdown."
        },
        {
            categoryId: "productividad",
            title: "How I Plan a Productive Week in Under 10 Minutes with Amplenote",
            author: "Shu Omi",
            summary: "Se presenta un método de planificación semanal con Amplenote que utiliza un 'task score' para priorizar tareas importantes y urgentes."
        },
        {
            categoryId: "productividad",
            title: "If You're 55-75 Years Old: STOP Wasting Your Golden Years (2024)",
            author: "Elderly Revenge Stories",
            summary: "El vídeo aconseja que en la etapa de 55 a 75 años, el equilibrio de la vida debe inclinarse hacia lo que nutre el espíritu."
        },
        {
            categoryId: "productividad",
            title: "Import PDFs into Excel with Power Query",
            author: "Victor Chan",
            summary: "Se muestra una técnica avanzada para importar datos desde un PDF a Excel utilizando Power Query."
        },
        {
            categoryId: "productividad",
            title: "My Obsidian Setup: The King of Note Taking Apps",
            author: "Christopher Lawley",
            summary: "Se describen las características de Obsidian, como la capacidad de enlazar notas para ver conexiones entre ideas."
        },
        {
            categoryId: "productividad",
            title: "Obsidian: The King of Learning Tools (FULL GUIDE + SETUP)",
            author: "Odysseas",
            summary: "Se ofrece una guía para organizar carpetas en Obsidian, recomendando un sistema de seis carpetas principales."
        },
        {
            categoryId: "productividad",
            title: "Planifica tu Semana de alta Productividad en lo que tomas un Café (menos 30min)",
            author: "InvernovAH",
            summary: "Se propone un sistema flexible de planificación semanal en menos de 30 minutos, basado en tres preguntas clave."
        },
        {
            categoryId: "productividad",
            title: "QUIERES APRENDER DESDE CERO CUALQUIER COSA? PARA UN EXAMEN? 8 TÉCNICAS-NAZARETH CASTELLANOS",
            author: "SABIDURÍA NEUROCORPORAL",
            summary: "Se explica que el cerebro integra y organiza la información durante las pausas y los descansos, no solo durante el estudio activo."
        },
        {
            categoryId: "productividad",
            title: "What Nobody Tells You About Organizing Folders in Obsidian",
            author: "Linking Your Thinking with Nick Milo",
            summary: "Se argumenta que el tiempo dedicado a organizar carpetas no se invierte en lo verdaderamente importante: conectar ideas."
        },
        {
            categoryId: "productividad",
            title: "❤️ Top 30 Excel Tips and Tricks to save 30+ hours of work",
            author: "Victor Chan",
            summary: "Se presentan trucos de Excel para mejorar la productividad, como convertir un rango de datos en una tabla (Ctrl+T)."
        },

        // 9.0 Psicología y Filosofía
        {
            categoryId: "psicologia",
            title: "#59 - ¡HAY SALIDA! Descubrir Tu Propósito Cambiará Tu Vida | Tony Estruch en Roca Project",
            author: "ROCA PROJECT",
            summary: "Se critica el sistema educativo por no preparar a las personas para los desafíos vitales ni para gestionar sus emociones."
        },
        {
            categoryId: "psicologia",
            title: "10 COSAS que DEBES HACER CADA MAÑANA para DOMINAR TU MENTE y TU DÍA | ESTOICISMO",
            author: "Fortaleza Filosófica",
            summary: "Desde una perspectiva estoica, se afirma que mantener presente la idea de la mortalidad impulsa a vivir con propósito y gratitud."
        },
        {
            categoryId: "psicologia",
            title: "6 Claves Para Un Buen Cerebro - Alfred Sonnenfeld",
            author: "Alex Fidalgo",
            summary: "Se reflexiona sobre la dignidad y la irrepetibilidad de cada individuo, argumentando que la verdad de una persona es mucho más que su composición biológica."
        },
        {
            categoryId: "psicologia",
            title: "Carl Jung: La vida realmente COMIENZA a los 50 años",
            author: "Visiones 360",
            summary: "Se explora la idea de Carl Jung de que los 50 años no son un final, sino un nuevo comienzo que invita a ser más auténtico."
        },
        {
            categoryId: "psicologia",
            title: "Cómo Ser Extremadamente Disciplinado",
            author: "DR LA ROSA",
            summary: "Se explica que la disciplina se desarrolla al hacer voluntariamente cosas que no queremos hacer. Esta práctica fortalece un área específica del cerebro."
        },
        {
            categoryId: "psicologia",
            title: "EL SECRETO de SPINOZA para Vivir Sin Miedo ¿Y Por Qué Nadie Te Lo Dijo?",
            author: "Reflexión Infinita",
            summary: "Se presenta la filosofía de Spinoza, quien afirmaba que la felicidad no reside en controlar el mundo, sino en comprenderlo."
        },
        {
            categoryId: "psicologia",
            title: "Experta en Alto Rendimiento: 'el talento solo es el 20%, el 80% restante es... '",
            author: "Tiene Sentido Pódcast",
            summary: "Se argumenta que la motivación es imprescindible para alcanzar objetivos, pero no se puede contar con ella como única herramienta."
        },
        {
            categoryId: "psicologia",
            title: "Hablamos de las Cosas Importantes de la Vida, con Emilio Duró",
            author: "NUDE PROJECT",
            summary: "El ponente sostiene que el 98% de lo que sucede en la vida no depende de nuestra planificación. Aconseja no dramatizar los fracasos."
        },
        {
            categoryId: "psicologia",
            title: "La FÓRMULA para estar MOTIVADO y sin PROCRASTINAR.",
            author: "Nekodificador",
            summary: "Se analiza la diferencia entre 'tener que hacer' y 'querer hacer'. La clave de la motivación está en el beneficio que se obtiene al completar la tarea."
        },
        {
            categoryId: "psicologia",
            title: "La Vida Explicada en 21 Minutos – Carl Jung",
            author: "El Consejero",
            summary: "Se expone la teoría de Carl Jung sobre la tensión entre el 'ego' y el 'self'. Las crisis pueden ser un llamado para escuchar nuestra verdadera esencia."
        },
        {
            categoryId: "psicologia",
            title: "Nivel 1 al 100: Conceptos Filosóficos Tan Profundos Que Te Harán Dormir Pensando",
            author: "Más inteligente durmiendo",
            summary: "Se exploran conceptos como la metaética, que cuestiona la naturaleza de la moralidad, y el problema del criterio."
        },
        {
            categoryId: "psicologia",
            title: "🚀La Regla de los 5 Segundos Para Cambiar tu Vida - Mel Robbins",
            author: "Subconsciente Consciente ES",
            summary: "Se presenta la 'regla de los 5 segundos' como una herramienta para superar la inacción."
        },

        // 10.0 Salud y Bienestar
        {
            categoryId: "salud",
            title: "CÓMO es el ENTRENAMIENTO PERFECTO para la LONGEVIDAD | Marcos Vázquez",
            author: "Hijos de la Resistencia",
            summary: "Se argumenta que nunca es tarde para empezar a hacer ejercicio. El cuerpo humano tiene una gran plasticidad y puede mejorar a cualquier edad."
        },
        {
            categoryId: "salud",
            title: "El Ejercicio Ideal para Vivir Más",
            author: "DR LA ROSA",
            summary: "Se destaca el VO2 Max (capacidad aeróbica) como una métrica crucial para la longevidad."
        },
        {
            categoryId: "salud",
            title: "Mi Semana de Entrenamiento Híbrido 💪🔥 para GANAR MÚSCULO sin aumentar Grasa",
            author: "The Saiyan Kiwi",
            summary: "Se explica que la distribución de entrenamiento más óptima para principiantes es una rutina de cuerpo completo tres días a la semana."
        },
        {
            categoryId: "salud",
            title: "Utiliza el Método Pilates para ser Más Fuerte, Ágil y Flexible en 90 días (Experta Mundial PILATES)",
            author: "Dr. Borja Bandera",
            summary: "El método Pilates se presenta como un complemento a otros entrenamientos, enfocándose en la postura y la activación de la musculatura profunda."
        },
        {
            categoryId: "salud",
            title: "What Happens If You Don't Eat For 100 Hours?",
            author: "Dr. Sten Ekberg",
            summary: "Se describen los cambios metabólicos durante un ayuno prolongado, explicando que el cuerpo aprende a utilizar la grasa como principal fuente de energía."
        },

        // 11.0 Economía y Geopolítica
        {
            categoryId: "economia",
            title: "How China Plans to Become the New World Power",
            author: "VisualPolitik EN",
            summary: "Se analiza la estrategia de China para convertirse en la nueva potencia mundial a través de inversiones en infraestructura y tecnología."
        },
        {
            categoryId: "economia",
            title: "Why the Global Economy Is on the Brink",
            author: "Economics Explained",
            summary: "Se exploran los factores que están llevando a la economía global hacia una posible recesión, incluyendo la inflación y las tensiones geopolíticas."
        },
        {
            categoryId: "economia",
            title: "The Rise of BRICS: A New World Order?",
            author: "TLDR News Global",
            summary: "Se examina el crecimiento del bloque BRICS y su potencial para desafiar el dominio económico occidental."
        },

        // 12.0 Tecnología y Futuro Digital
        {
            categoryId: "tecnologia",
            title: "Web3 Explained: The Future of the Internet",
            author: "Fireship",
            summary: "Se explica el concepto de Web3 y cómo las tecnologías descentralizadas podrían transformar la forma en que interactuamos en internet."
        },
        {
            categoryId: "tecnologia",
            title: "Quantum Computing: The Next Big Thing",
            author: "Veritasium",
            summary: "Se analiza el estado actual de la computación cuántica y su potencial para revolucionar campos como la criptografía y la simulación molecular."
        },
        {
            categoryId: "tecnologia",
            title: "The Future of Electric Vehicles in 2025",
            author: "Fully Charged Show",
            summary: "Se discuten las tendencias en el mercado de vehículos eléctricos y las innovaciones en tecnología de baterías."
        }
    ]
};

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = videosData;
}
