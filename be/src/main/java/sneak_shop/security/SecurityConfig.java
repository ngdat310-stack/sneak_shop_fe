package sneak_shop.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import sneak_shop.entity.UserEntity;
import sneak_shop.enums.UserRole;
import sneak_shop.repository.UserRepository;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final String PRIMARY_ADMIN_EMAIL = "phamcuong26.dev@gmail.com";

    @Value("${web.cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            RestAuthenticationEntryPoint authenticationEntryPoint,
            RestAccessDeniedHandler accessDeniedHandler,
            JwtAuthenticationFilter jwtAuthenticationFilter
    ) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/swagger-ui/**", "/api-docs/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/images/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/google").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/zalo-login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register-email").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/send-register-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/verify-register-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/send-phone-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/send-email-verification-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/verify-phone-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/verify-email-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register-phone").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/dev/phone-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/forgot-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/verify-otp").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/reset-password").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/banners").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/categories/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/reviews/product/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/api/payments/momo/**").permitAll()
                        .requestMatchers("/api/payments/zalopay/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/contact").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/public/upload").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/contact/my").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/admin/contacts/**").hasRole("ADMIN")
                        .requestMatchers("/api/user/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/cart/**", "/api/orders/**", "/api/addresses/**",
                                "/api/reviews/**", "/api/notifications/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/chat/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/admin/chat/**").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/").permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CommandLineRunner seedDefaultUsers(UserRepository userRepository, PasswordEncoder encoder) {
        return args -> {
            seedUser(userRepository, encoder, PRIMARY_ADMIN_EMAIL, "Cuong", "123456", "0900000001", UserRole.admin);
            seedUser(userRepository, encoder, "user@sneakshop.vn", "User", "123456", "0900000002", UserRole.user);
        };
    }

    private void seedUser(UserRepository repo, PasswordEncoder enc,
                          String email, String fullName, String rawPwd, String phone, UserRole role) {
        String resolvedPhone = (phone == null || phone.isBlank()) ? "0900000001" : phone;
        repo.findByEmail(email).ifPresentOrElse(
                existing -> {
                    existing.setFullName(fullName);
                    existing.setPassword(enc.encode(rawPwd));
                    existing.setRole(role);
                    if (existing.getPhone() == null || existing.getPhone().isBlank()) {
                        existing.setPhone(resolvedPhone);
                    }
                    repo.save(existing);
                },
                () -> repo.save(UserEntity.builder()
                        .email(email)
                        .fullName(fullName)
                        .password(enc.encode(rawPwd))
                        .phone(resolvedPhone)
                        .role(role)
                        .build())
        );
    }
}
