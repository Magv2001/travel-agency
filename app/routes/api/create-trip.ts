import { GoogleGenerativeAI } from "@google/generative-ai";
import { ID } from "appwrite";
import { data, type ActionFunctionArgs } from "react-router";
import { appwriteConfig, database } from "~/appwrite/client";
import { parseMarkdownToJson } from "~/lib/utils";

const MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithFallback(genAI: GoogleGenerativeAI, prompt: string) {
    let lastError: unknown;

    for (const modelName of MODELS) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: { responseMimeType: "application/json" },
                });
                return await model.generateContent([prompt]);
            } catch (e: any) {
                lastError = e;
                const retryable = [429, 500, 503].includes(e?.status);
                if (!retryable) throw e; // errores como 400 o 404 no se reintentan
                console.warn(`${modelName} falló (${e.status}), intento ${attempt + 1}`);
                await sleep(1000 * 2 ** attempt); // espera 1s y luego 2s
            }
        }
    }

    throw lastError;
}

export const action = async ({ request }: ActionFunctionArgs) => {
    const  {
        country,
        numberOfDays,
        travelStyle,
        interests,
        budget,
        groupType,
        userId,
    } = await request.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const unsplashApiKey = process.env.UNSPLASH_ACCESS_KEY!;

    try {
        const prompt = `Generate a ${numberOfDays}-day travel itinerary for ${country} based on the following user information:
        Budget: '${budget}'
        Interests: '${interests}'
        TravelStyle: '${travelStyle}'
        GroupType: '${groupType}'
        Return the itinerary and lowest estimated price in a clean, non-markdown JSON format with the following structure:
        {
            "name": "A descriptive title for the trip",
            "description": "A brief description of the trip and its highlights not exceeding 100 words",
            "estimatedPrice": "Lowest average price for the trip in USD, e.g.$price",
            "duration": ${numberOfDays},
            "budget": "${budget}",
            "travelStyle": "${travelStyle}",
            "country": "${country}",
            "interests": "${interests}",
            "groupType": "${groupType}",
            "bestTimeToVisit": [
                '🌸 Season (from month to month): reason to visit',
                '☀️ Season (from month to month): reason to visit',
                '🍁 Season (from month to month): reason to visit',
                '❄️ Season (from month to month): reason to visit'
            ],
            "weatherInfo": [
                '☀️ Season: temperature range in Celsius (temperature range in Fahrenheit)',
                '🌦️ Season: temperature range in Celsius (temperature range in Fahrenheit)',
                '🌧️ Season: temperature range in Celsius (temperature range in Fahrenheit)',
                '❄️ Season: temperature range in Celsius (temperature range in Fahrenheit)'
            ],
            "location": {
                "city": "name of the city or region",
                "coordinates": [latitude, longitude],
                "openStreetMap": "link to open street map"
            },
            "itinerary": [
                {
                    "day": 1,
                    "location": "City/Region Name",
                    "activities": [
                        {"time": "Morning", "description": "🏰 Visit the local historic castle and enjoy a scenic walk"},
                        {"time": "Afternoon", "description": "🖼️ Explore a famous art museum with a guided tour"},
                        {"time": "Evening", "description": "🍷 Dine at a rooftop restaurant with local wine"}
                    ]
                },
                ...
            ]
        }`;

        const textResult = await generateWithFallback(genAI, prompt);

        const trip = parseMarkdownToJson(textResult.response.text());

        if (!trip) {
            throw new Error("No se pudo interpretar la respuesta de la IA");
        }

        const imageResponse = await fetch(
            `https://api.unsplash.com/search/photos?query=${country} ${interests} ${travelStyle}&client_id=${unsplashApiKey}`
        );

        const imageUrls = (await imageResponse.json()).results.slice(0, 3)
            .map((result: any) => result.urls?.regular || null);

        const result = await database.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.tripCollectionId,
            ID.unique(),
            {
                tripDetail: JSON.stringify(trip),
                createdAt: new Date().toISOString(),
                imageUrls,
                userId,
            }
        )

        return data({ id: result.$id })
    } catch (e) {
        console.error("Error generating travel plan: ", e);
        return data(
            { error: "No se pudo generar el viaje. Intenta de nuevo en unos minutos." },
            { status: 503 }
        );
    }
}