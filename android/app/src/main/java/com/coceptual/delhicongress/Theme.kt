package com.coceptual.delhicongress

import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

/**
 * Two typefaces in one family, split by weight: everything bold (headings, names, numbers, buttons marked bold)
 * is Poppins, and running text is Mukta. Both carry Hindi and English, so a mixed line stays in one face.
 * Screens only set fontWeight; the face follows from it.
 */
internal val AppFont = FontFamily(
    Font(R.font.mukta_regular, FontWeight.Normal),
    Font(R.font.mukta_medium, FontWeight.Medium),
    Font(R.font.poppins_semibold, FontWeight.SemiBold),
    Font(R.font.poppins_bold, FontWeight.Bold),
    Font(R.font.poppins_bold, FontWeight.ExtraBold),
)

internal val AppTypography = Typography().let { t ->
    Typography(
        displayLarge = t.displayLarge.copy(fontFamily = AppFont), displayMedium = t.displayMedium.copy(fontFamily = AppFont), displaySmall = t.displaySmall.copy(fontFamily = AppFont),
        headlineLarge = t.headlineLarge.copy(fontFamily = AppFont), headlineMedium = t.headlineMedium.copy(fontFamily = AppFont), headlineSmall = t.headlineSmall.copy(fontFamily = AppFont),
        titleLarge = t.titleLarge.copy(fontFamily = AppFont), titleMedium = t.titleMedium.copy(fontFamily = AppFont), titleSmall = t.titleSmall.copy(fontFamily = AppFont),
        bodyLarge = t.bodyLarge.copy(fontFamily = AppFont), bodyMedium = t.bodyMedium.copy(fontFamily = AppFont), bodySmall = t.bodySmall.copy(fontFamily = AppFont),
        labelLarge = t.labelLarge.copy(fontFamily = AppFont), labelMedium = t.labelMedium.copy(fontFamily = AppFont), labelSmall = t.labelSmall.copy(fontFamily = AppFont),
    )
}
